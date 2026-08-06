"""Notícias no resumo de /summarize.

O que estes testes guardam é o repasse do texto do currículo à coleta externa.
Sem ele o score não ganha os pontos de título casado e o filtro de notícias fica
sem os termos de contexto do CV, então o perfil raramente chega a confiança alta
e a seção de notícias some do resumo — sem erro nenhum, só ausência.
"""

import types
from datetime import date

import pytest
from fastapi import HTTPException

from src.api.routers import ai as ai_router
from src.core.perfil_externo import NoticiaExterna, PerfilExterno

TEXTO_CV = "texto integral do curriculo lattes"

NOTICIA = NoticiaExterna(
    titulo="Docente coordena projeto premiado",
    url="https://exemplo.test/materia",
    veiculo="Jornal da UFSCar",
    data=date(2026, 1, 15),
)


def _patch_common(monkeypatch, *, perfil: PerfilExterno | None) -> dict:
    """Isola /summarize de I/O e devolve o dicionário de chamadas capturadas."""
    capturado: dict = {}

    async def fake_source(nome, log=None):
        return types.SimpleNamespace(
            texto=TEXTO_CV,
            texto_pdf="texto pdf",
            texto_html="texto html",
            fonte="pdf",
            caracteres_pdf=len(TEXTO_CV),
            caracteres_html=0,
        )

    async def fake_perfil(nome, *, texto_curriculo=None, log=None, **kwargs):
        capturado["texto_curriculo"] = texto_curriculo
        return perfil

    async def fake_resumir(texto, **kwargs):
        capturado["noticias"] = kwargs.get("noticias")
        return "## Resumo\n\nConteúdo gerado por IA."

    monkeypatch.setattr(ai_router, "get_summary_source", fake_source)
    monkeypatch.setattr(ai_router, "get_perfil_externo", fake_perfil)
    monkeypatch.setattr(ai_router, "resumir_curriculo", fake_resumir)
    return capturado


def _request(**kwargs):
    campos = {
        "nome": "Fulano de Tal",
        "api_key": None,
        "modelo": "qwen3:14b",
        "provedor": "ollama",
        "secao": None,
    }
    campos.update(kwargs)
    return types.SimpleNamespace(**campos)


def _http_request():
    return types.SimpleNamespace(headers={})


async def test_summarize_desambigua_perfil_externo_com_o_curriculo(monkeypatch):
    """O texto do CV precisa chegar à coleta externa.

    É o sinal mais forte da desambiguação: casar títulos do OpenAlex com o que o
    docente declarou no Lattes. O lote já fazia isso via resolver_perfil_externo;
    aqui o currículo está em mãos antes da coleta, então vai direto.
    """
    perfil = PerfilExterno(
        nome_busca="Fulano de Tal",
        confianca="alta",
        openalex_author_id="A123",
        noticias=(NOTICIA,),
    )
    capturado = _patch_common(monkeypatch, perfil=perfil)

    await ai_router.summarize(_request(), _http_request())

    assert capturado["texto_curriculo"] == TEXTO_CV
    assert capturado["noticias"] == (NOTICIA,)


async def test_summarize_ignora_noticia_de_perfil_sem_confianca_alta(monkeypatch):
    """Confiança média não passa: no resumo a procedência some na redação."""
    perfil = PerfilExterno(
        nome_busca="Fulano de Tal",
        confianca="media",
        openalex_author_id="A123",
        noticias=(NOTICIA,),
    )
    capturado = _patch_common(monkeypatch, perfil=perfil)

    await ai_router.summarize(_request(), _http_request())

    assert capturado["texto_curriculo"] == TEXTO_CV
    assert capturado["noticias"] == ()


async def test_summarize_de_secao_nao_coleta_perfil_externo(monkeypatch):
    """Quem pede uma seção pediu um recorte do Lattes, não imprensa.

    Além de não mandar notícia ao modelo, não vale gastar a ida à rede.
    """
    perfil = PerfilExterno(
        nome_busca="Fulano de Tal",
        confianca="alta",
        openalex_author_id="A123",
        noticias=(NOTICIA,),
    )
    capturado = _patch_common(monkeypatch, perfil=perfil)
    monkeypatch.setattr(
        ai_router,
        "extrair_secao",
        lambda *a, **k: types.SimpleNamespace(
            texto="recorte da secao",
            texto_pdf="recorte pdf",
            texto_html="recorte html",
        ),
    )

    await ai_router.summarize(_request(secao="formacao"), _http_request())

    assert "texto_curriculo" not in capturado
    assert capturado["noticias"] == ()


async def test_summarize_segue_sem_noticia_quando_nao_ha_perfil(monkeypatch):
    """Perfil externo desligado ou sem match não pode derrubar o resumo."""
    capturado = _patch_common(monkeypatch, perfil=None)

    await ai_router.summarize(_request(), _http_request())

    assert capturado["noticias"] == ()


async def test_summarize_exige_nome(monkeypatch):
    _patch_common(monkeypatch, perfil=None)

    with pytest.raises(HTTPException) as exc:
        await ai_router.summarize(_request(nome="   "), _http_request())

    assert exc.value.status_code == 400
