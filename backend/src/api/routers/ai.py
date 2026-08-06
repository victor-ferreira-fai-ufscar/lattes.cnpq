from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from ...core.perfil_externo import NoticiaExterna
from ...core.perfil_externo_cache import get_perfil_externo
from ...core.sections import SECOES_VALIDAS, extrair_secao, label_da_secao
from ...core.summarizer import listar_modelos, resumir_curriculo
from ...core.summary_source_cache import get_summary_source
from ...libs.logging import build_logger
from ...libs.request_monitor import (
    REQUEST_ID_HEADER,
    publish_request_error,
    publish_request_start,
    request_monitor,
)
from ...models import ModelsRequest, SummarizeRequest
from ._helpers import noticias_publicaveis

router = APIRouter()


@router.post("/summarize")
async def summarize(request: SummarizeRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="summarize",
        title="Gerando resumo com IA",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
        nome = request.nome.strip()
        add_log("Request /summarize recebida.")
        if not nome:
            raise HTTPException(status_code=400, detail="Informe o nome do docente.")

        # Seção solicitada (None/desconhecida = currículo completo).
        secao = (request.secao or "").strip().lower() or None
        if secao and secao not in SECOES_VALIDAS:
            add_log(
                f"Seção '{secao}' não reconhecida; gerando resumo do currículo completo."
            )
            secao = None
        secao_label = label_da_secao(secao)
        if secao_label:
            add_log(f"Resumo restrito à seção '{secao_label}'.")

        add_log(f"Coletando texto do currículo de '{nome}' com prioridade para PDF.")
        t_scrape = perf_counter()
        try:
            source_result = await get_summary_source(nome, log=add_log)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        texto = source_result.texto
        texto_pdf = source_result.texto_pdf
        texto_html = source_result.texto_html

        if source_result.fonte == "pdf":
            add_log(
                "Texto do currículo coletado a partir do PDF "
                f"({source_result.caracteres_pdf} caracteres extraídos)."
            )
        else:
            add_log(
                "PDF indisponível ou incompleto para resumo; usando HTML da página como fallback "
                f"({source_result.caracteres_html} caracteres, PDF extraído: {source_result.caracteres_pdf})."
            )

        add_log(
            "Texto-base do currículo coletado em "
            f"{(perf_counter() - t_scrape):.1f}s ({len(texto)} caracteres)."
        )

        # Recorte da seção (estratégia híbrida): tenta isolar o trecho da seção
        # para enviar só ele à IA; se não conseguir, mantém o currículo inteiro e
        # o prompt instrui o modelo a focar apenas na seção.
        if secao:
            recorte = extrair_secao(
                texto_pdf,
                texto_html,
                secao,
                fonte_preferida=source_result.fonte,
            )
            if recorte is not None:
                texto = recorte.texto
                texto_pdf = recorte.texto_pdf
                texto_html = recorte.texto_html
                add_log(
                    f"Seção '{secao_label}' isolada do currículo "
                    f"({len(recorte.texto)} caracteres); enviando apenas ela à IA."
                )
            else:
                add_log(
                    f"Não foi possível isolar a seção '{secao_label}' no texto; "
                    "enviando o currículo inteiro e pedindo foco nessa seção."
                )

        # Notícias entram só no resumo do currículo inteiro. Num resumo de seção
        # o pedido é um recorte do Lattes, e o perfil externo não pertence a ele.
        noticias: tuple[NoticiaExterna, ...] = ()
        if not secao:
            # O texto do currículo entra na desambiguação, e aqui ele já está em
            # mãos: uma chamada só, com ele. O lote precisa de duas tentativas
            # (resolver_perfil_externo) porque dispara a coleta antes do
            # scraping terminar; sem essa restrição, repetir o padrão só custaria
            # uma ida à rede. Passar o CV nunca piora — rende os pontos de
            # título casado no score e amplia os termos de contexto do filtro de
            # notícias. `source_result.texto` e não `texto`: este último pode ter
            # sido reduzido ao recorte da seção logo acima.
            perfil_externo = await get_perfil_externo(
                nome, texto_curriculo=source_result.texto, log=add_log
            )
            noticias = noticias_publicaveis(perfil_externo)
            if noticias:
                add_log(
                    f"{len(noticias)} notícia(s) do perfil externo incluída(s) no resumo."
                )
            elif perfil_externo is not None and not perfil_externo.publicavel:
                add_log(
                    "Perfil externo sem confiança alta; notícias não entram no resumo."
                )

        add_log(
            f"Enviando texto para IA (provedor='{request.provedor}', modelo='{request.modelo}')."
        )
        t_ai = perf_counter()
        try:
            resumo = await resumir_curriculo(
                texto,
                texto_pdf=texto_pdf,
                texto_html=texto_html,
                api_key=request.api_key,
                modelo=request.modelo,
                provedor=request.provedor,
                secao=secao,
                noticias=noticias,
                log=add_log,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Erro ao chamar a IA: {exc}",
            ) from exc

        add_log(f"Resumo gerado em {(perf_counter() - t_ai):.1f}s.")
        add_log("Request /summarize finalizada com sucesso.")

        return {
            "nome": nome,
            "resumo": resumo,
            "secao": secao,
            "secao_label": secao_label,
            "fonte_resumo": source_result.fonte,
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
        }
    except HTTPException as exc:
        publish_request_error(request_id, str(exc.detail))
        raise
    except Exception as exc:
        publish_request_error(request_id, str(exc) or "Falha ao gerar resumo.")
        raise
    finally:
        request_monitor.complete(request_id)


@router.post("/models")
async def models(request: ModelsRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    provedor = (request.provedor or "ollama").strip().lower()
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="models",
        title="Atualizando opções de modelos",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
        add_log("Request /models recebida.")
        add_log(f"Consultando modelos disponíveis para o provedor '{provedor}'.")
        try:
            modelos = await listar_modelos(
                provedor=provedor,
                api_key=request.api_key,
                log=add_log,
            )
        except ValueError as exc:
            publish_request_error(request_id, str(exc))
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            publish_request_error(
                request_id,
                f"Erro ao listar modelos do provedor '{provedor}': {exc}",
            )
            raise HTTPException(
                status_code=502,
                detail=f"Erro ao listar modelos do provedor '{provedor}': {exc}",
            ) from exc

        add_log(f"{len(modelos)} modelo(s) recebido(s) para o provedor '{provedor}'.")
        add_log("Request /models finalizada com sucesso.")

        return {
            "provedor": provedor,
            "total": len(modelos),
            "modelos": modelos,
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
        }
    finally:
        request_monitor.complete(request_id)
