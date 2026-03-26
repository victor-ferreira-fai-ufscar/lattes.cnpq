import asyncio
import json
import os
from typing import Callable, Optional

from google import genai
from openai import OpenAI
from playwright.async_api import Locator, Page, TimeoutError, async_playwright
from rich.console import Console

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

console = Console()


class LattesScraperError(Exception):
    """Erro base para falhas do scraping."""


class DocenteNaoEncontradoError(LattesScraperError):
    """Disparado quando a busca não retorna um docente utilizável."""


class CurriculoNaoEncontradoError(LattesScraperError):
    """Disparado quando não foi possível abrir o currículo do docente."""


class ExtracaoCurriculoError(LattesScraperError):
    """Disparado quando o currículo abriu, mas não foi possível extrair contexto suficiente."""


def _log(
    msg: str, callback: Optional[Callable[[str], None]] = None, style: str = "cyan"
):
    """Helper para logar no console local e via callback customizado (ex: FastAPI ou UI)."""
    # Só imprime no terminal se não houver callback configurado.
    # Isso evita poluir o terminal em execuções de backend automáticas.
    if not callback:
        rich_msg = f"[{style}]{msg}[/]"
        if "green" in style or "✓" in msg:
            rich_msg = f"[bold green]{msg}[/]"
        elif "red" in style or "!" in msg:
            rich_msg = f"[bold red]{msg}[/]"
        console.print(rich_msg)

    if callback:
        try:
            callback(msg)
        except Exception:
            pass


def _headless_from_env() -> bool:
    return os.environ.get("HEADLESS", "true").lower() == "true"


async def _localizar_botao_abrir(page: Page) -> Optional[Locator]:
    seletores = [
        "#idbtnabrircurriculo",
        "input[value='Abrir Currículo']",
        "input[value='Abrir Curriculo']",
        "a:has-text('Abrir Currículo')",
        "a:has-text('Abrir Curriculo')",
        "text='Abrir Currículo'",
        "text='Abrir Curriculo'",
    ]
    for seletor in seletores:
        locator = page.locator(seletor)
        try:
            if await locator.count() > 0:
                return locator.first
        except Exception:
            continue
    return None


async def _extrair_contexto_pagina(
    page: Page, log_callback: Optional[Callable[[str], None]] = None
) -> str:
    _log("[*] Capturando HTML completo e texto visível do currículo...", log_callback)

    html_completo = await page.content()
    texto_visivel = ""

    try:
        body = page.locator("body")
        if await body.count() > 0:
            texto_visivel = await body.inner_text(timeout=10000)
    except Exception as exc:
        _log(
            f"[!] Não consegui capturar o texto visível completo: {exc}",
            log_callback,
            "yellow",
        )

    contexto = (
        f"URL_FINAL: {page.url}\n"
        f"TITULO_PAGINA: {await page.title()}\n\n"
        "TEXTO_VISIVEL_EXTRAIDO:\n"
        f"{texto_visivel.strip()}\n\n"
        "HTML_COMPLETO:\n"
        f"{html_completo}"
    )

    if len(html_completo.strip()) < 200 and len(texto_visivel.strip()) < 100:
        raise ExtracaoCurriculoError(
            "O currículo foi aberto, mas a página retornou conteúdo insuficiente para análise."
        )

    _log(
        f"[✓] Contexto coletado com sucesso ({len(texto_visivel)} caracteres de texto e {len(html_completo)} de HTML).",
        log_callback,
        "bold green",
    )
    return contexto


async def scrape_lattes(
    query_name: str,
    log_callback: Optional[Callable[[str], None]] = None,
    headless: Optional[bool] = None,
) -> str:
    """Extrai texto visível e HTML completo do currículo Lattes de um docente."""
    query_name = query_name.strip()
    if not query_name:
        raise DocenteNaoEncontradoError("Informe um nome para iniciar a busca.")

    if headless is None:
        headless = _headless_from_env()

    _log(
        f"[*] Iniciando automação para buscar por '{query_name}'...",
        log_callback,
        "bold cyan",
    )
    _log(
        (
            "[*] Navegador visível durante a automação."
            if not headless
            else "[*] Navegador em modo headless."
        ),
        log_callback,
    )

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=headless)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            _log("[*] Acessando busca textual do Lattes...", log_callback)
            await page.goto(
                "https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar",
                wait_until="domcontentloaded",
            )

            _log("[*] Preenchendo formulário de busca...", log_callback)
            await page.locator("input[name='textoBusca']").fill(query_name)
            await page.locator("#botaoBuscaFiltros").first.click()

            _log("[*] Aguardando resultados da busca...", log_callback)
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1200)

            resultados = page.locator(".resultado a")
            total_resultados = await resultados.count()
            if total_resultados == 0:
                html_busca = (await page.content()).lower()
                mensagens_sem_resultado = [
                    "nenhum currículo encontrado",
                    "nenhum curriculo encontrado",
                    "nenhum resultado encontrado",
                    "nenhum resultado foi encontrado",
                ]
                if any(mensagem in html_busca for mensagem in mensagens_sem_resultado):
                    raise DocenteNaoEncontradoError(
                        f"Nenhum docente encontrado para '{query_name}'. Confira a grafia e tente novamente."
                    )
                raise DocenteNaoEncontradoError(
                    f"A busca por '{query_name}' não retornou resultados utilizáveis no Lattes."
                )

            _log(
                f"[✓] {total_resultados} resultado(s) encontrado(s).",
                log_callback,
                "bold green",
            )

            resultado_exato = page.locator(".resultado a", has_text=query_name)
            if await resultado_exato.count() > 0:
                primeiro_resultado = resultado_exato.first
                _log(
                    "[*] Abrindo o resultado mais compatível com o nome informado...",
                    log_callback,
                )
            else:
                primeiro_resultado = resultados.first
                _log(
                    "[!] Não encontrei correspondência exata; abrindo o primeiro resultado disponível.",
                    log_callback,
                    "yellow",
                )

            await primeiro_resultado.click(timeout=10000)

            _log("[*] Buscando a ação 'Abrir Currículo'...", log_callback)
            await page.wait_for_timeout(1500)
            botao_abrir = await _localizar_botao_abrir(page)
            if not botao_abrir:
                raise CurriculoNaoEncontradoError(
                    f"Encontrei resultados para '{query_name}', mas não localizei o botão 'Abrir Currículo'."
                )

            await botao_abrir.wait_for(state="visible", timeout=10000)

            _log("[*] Abrindo a página completa do currículo...", log_callback)
            try:
                async with context.expect_page(timeout=15000) as nova_pagina:
                    await botao_abrir.click()
                page_cv = await nova_pagina.value
            except TimeoutError:
                _log(
                    "[!] A nova aba demorou para abrir. Tentando fallback...",
                    log_callback,
                    "yellow",
                )
                await botao_abrir.click(force=True)
                await page.wait_for_timeout(5000)
                page_cv = context.pages[-1] if len(context.pages) > 1 else page

            await page_cv.wait_for_load_state("domcontentloaded")
            await page_cv.wait_for_timeout(2000)

            _log(
                f"[✓] Currículo acessado: {page_cv.url[:80]}...",
                log_callback,
                "bold green",
            )
            return await _extrair_contexto_pagina(page_cv, log_callback)

        finally:
            await browser.close()


def gerar_resumo_ia(
    texto: str,
    provedor: str,
    modelo: str,
    api_key: Optional[str] = None,
    log_callback: Optional[Callable[[str], None]] = None,
) -> dict:
    """Roteador para gerar o resumo estruturado usando diferentes provedores de IA."""
    if provedor.lower() == "google gemini":
        return _gerar_resumo_gemini(texto, modelo, api_key, log_callback)
    if provedor.lower() == "openai":
        return _gerar_resumo_openai(texto, modelo, api_key, log_callback)
    return {"erro": f"Provedor '{provedor}' não suportado."}


def _gerar_resumo_gemini(
    texto: str,
    modelo: str,
    api_key: Optional[str],
    log_callback: Optional[Callable[[str], None]],
) -> dict:
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"erro": "Nenhuma chave (API Key) encontrada para o Google Gemini."}

    _log(f"[*] Enviando contexto para Google Gemini ({modelo})...", log_callback)
    try:
        client = genai.Client(api_key=api_key)
        prompt = _get_prompt(texto)
        response = client.models.generate_content(
            model=modelo,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )
        if not response or not response.text:
            return {"erro": "O Gemini não retornou conteúdo para esta análise."}
        return json.loads(response.text)
    except Exception as exc:
        return {"erro": f"Erro no Gemini: {exc}"}


def _gerar_resumo_openai(
    texto: str,
    modelo: str,
    api_key: Optional[str],
    log_callback: Optional[Callable[[str], None]],
) -> dict:
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"erro": "Nenhuma chave (API Key) encontrada para a OpenAI."}

    _log(f"[*] Enviando contexto para OpenAI ({modelo})...", log_callback)
    try:
        client = OpenAI(api_key=api_key)
        prompt = _get_prompt(texto)
        response = client.chat.completions.create(
            model=modelo,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você é um assistente especialista em analisar perfis acadêmicos do Lattes. "
                        "Retorne apenas JSON válido conforme solicitado."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            return {"erro": "A OpenAI retornou uma resposta vazia para esta análise."}
        return json.loads(content)
    except Exception as exc:
        return {"erro": f"Erro na OpenAI: {exc}"}


def _get_prompt(texto: str) -> str:
    return (
        "Com base no contexto de um Currículo Lattes abaixo, extraia as seguintes informações "
        "estritamente em formato JSON:\n"
        "- 'graduacao': Onde e qual curso (conciso)\n"
        "- 'mestrado': Onde e qual curso/tema (conciso)\n"
        "- 'doutorado': Onde e qual curso/tema (conciso)\n"
        "- 'pos_doutorado': Onde e qual instituição (opcional)\n"
        "- 'vinculo_institucional': Instituição atual de trabalho\n"
        "- 'resumo': Um resumo executivo de 2-3 parágrafos sobre a trajetória e pesquisa.\n\n"
        "O contexto mistura texto visível e HTML completo da página do currículo. "
        "Use ambos para inferir os dados, mas responda apenas com JSON puro. "
        "Se não houver alguma informação, deixe o campo como string vazia.\n\n"
        "CONTEXTO_LATTES:\n"
        f"{texto[:40000]}"
    )


if __name__ == "__main__":

    async def test():
        contexto = await scrape_lattes("Neocles")
        print(contexto[:1000])

    asyncio.run(test())
