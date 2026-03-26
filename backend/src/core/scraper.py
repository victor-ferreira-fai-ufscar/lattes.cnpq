import os
import re

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

_BASE_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar"


def _is_true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalizar(texto: str) -> str:
    return " ".join(texto.lower().split())


def _extract_first(texto: str, padroes: list[str]) -> str:
    for padrao in padroes:
        match = re.search(padrao, texto, flags=re.IGNORECASE)
        if match:
            return " ".join(match.group(0).split())
    return ""


def _extract_resumo(texto: str) -> str:
    for marcador in ["Resumo", "Resumo informado pelo autor"]:
        idx = texto.lower().find(marcador.lower())
        if idx >= 0:
            trecho = texto[idx : idx + 2500]
            linhas = [linha.strip() for linha in trecho.splitlines() if linha.strip()]
            if len(linhas) > 1:
                return " ".join(linhas[1:5])[:1200]

    linhas = [linha.strip() for linha in texto.splitlines() if linha.strip()]
    return " ".join(linhas[:10])[:1200]


def _parece_pagina_cv(url: str, texto: str) -> bool:
    texto_norm = _normalizar(texto)
    sinais_cv = [
        "endereço para acessar este cv",
        "ultima atualização do currículo",
        "resumo informado pelo autor",
        "formação acadêmica/titulação",
    ]
    if any(sinal in texto_norm for sinal in sinais_cv):
        return True

    return "lattes.cnpq.br" in (url or "").lower() and "resultado de" not in texto_norm


async def _tenta_abrir_cv_final(page, botao):
    try:
        async with page.context.expect_page(timeout=7000) as popup_info:
            await botao.first.click()
        popup = await popup_info.value
        await popup.wait_for_load_state("domcontentloaded")
        texto_popup = await popup.locator("body").inner_text(timeout=12000)
        if _parece_pagina_cv(popup.url, texto_popup):
            return popup
        await popup.close()
    except PlaywrightTimeoutError:
        await botao.first.click()
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(1200)

    texto_page = await page.locator("body").inner_text(timeout=12000)
    if _parece_pagina_cv(page.url, texto_page):
        return page
    return None


async def _abrir_curriculo(page, nome: str):
    last_error = None
    for _ in range(3):
        try:
            await page.goto(_BASE_URL, wait_until="domcontentloaded", timeout=45000)
            break
        except PlaywrightTimeoutError as exc:
            last_error = exc
            await page.wait_for_timeout(1200)
    else:
        raise ValueError(
            "Não foi possível acessar a busca do Lattes no momento."
        ) from last_error

    await page.locator("input[name='textoBusca']").fill(nome)

    # Em alguns momentos o Lattes precisa do grecaptcha carregado para disparar o submit.
    try:
        await page.wait_for_function(
            "() => typeof window.grecaptcha !== 'undefined'",
            timeout=10000,
        )
    except PlaywrightTimeoutError:
        pass

    await page.locator("#botaoBuscaFiltros:visible").first.click()
    await page.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1500)

    if "resultado de" not in _normalizar(await page.locator("body").inner_text()):
        raise ValueError("Nenhum resultado encontrado para o nome informado.")

    links = page.locator(".resultado a")
    total = await links.count()
    if total == 0:
        links = page.locator("a")
        total = await links.count()

    if total == 0:
        raise ValueError("Nenhum resultado encontrado para o nome informado.")

    alvo = None
    nome_norm = _normalizar(nome)
    for i in range(total):
        texto = _normalizar((await links.nth(i).inner_text()).strip())
        if not texto:
            continue
        if texto == nome_norm or nome_norm in texto:
            alvo = links.nth(i)
            break

    if alvo is None:
        alvo = links.nth(0)

    await alvo.click()
    await page.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1200)

    seletores_abrir = [
        "#idbtnabrircurriculo",
        "input[value='Abrir Currículo']",
        "input[value='Abrir Curriculo']",
        "a:has-text('Abrir Currículo')",
        "a:has-text('Abrir Curriculo')",
    ]

    # Se houver controles de "Abrir Currículo", precisamos acionar esse passo antes da captura.
    existe_controle_abrir = False
    for seletor in seletores_abrir:
        if await page.locator(seletor).count() > 0:
            existe_controle_abrir = True
            break

    if existe_controle_abrir:
        for seletor in seletores_abrir:
            botao = page.locator(seletor)
            if await botao.count() == 0:
                continue
            cv_page = await _tenta_abrir_cv_final(page, botao)
            if cv_page is not None:
                return cv_page

        # Fallback: alguns fluxos só respondem chamando a função JS do modal.
        try:
            async with page.context.expect_page(timeout=7000) as popup_info:
                await page.evaluate(
                    "window.chamarFuncaoAbreCV && window.chamarFuncaoAbreCV()"
                )
            popup = await popup_info.value
            await popup.wait_for_load_state("domcontentloaded")
            texto_popup = await popup.locator("body").inner_text(timeout=12000)
            if _parece_pagina_cv(popup.url, texto_popup):
                return popup
            await popup.close()
        except PlaywrightTimeoutError:
            pass

    texto_atual = await page.locator("body").inner_text(timeout=12000)
    if _parece_pagina_cv(page.url, texto_atual):
        return page

    raise ValueError("Não foi possível abrir a página final do currículo Lattes.")


def _extrair_dados(texto: str, url_final: str) -> dict:
    return {
        "graduacao": _extract_first(texto, [r"Gradua(?:ç|c)ão[^\n]{0,180}"]),
        "mestrado": _extract_first(texto, [r"Mestrado[^\n]{0,180}"]),
        "doutorado": _extract_first(texto, [r"Doutorado[^\n]{0,180}"]),
        "pos_doutorado": _extract_first(
            texto,
            [r"P[oó]s-?doutorado[^\n]{0,180}", r"Pos-?doutorado[^\n]{0,180}"],
        ),
        "vinculo_institucional": _extract_first(
            texto,
            [
                r"Universidade[^\n]{0,120}",
                r"Instituto[^\n]{0,120}",
                r"Faculdade[^\n]{0,120}",
            ],
        ),
        "resumo": _extract_resumo(texto),
        "url_cv": url_final,
    }


async def scrape_lattes(nome: str) -> dict:
    """Faz scraping determinístico do Lattes usando Playwright."""
    browser_name = os.environ.get("PLAYWRIGHT_BROWSER", "chromium").lower()
    headless = _is_true(os.environ.get("PLAYWRIGHT_HEADLESS", "true"))

    async with async_playwright() as p:
        browser_type = getattr(p, browser_name, p.chromium)
        browser = await browser_type.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )

        try:
            context = await browser.new_context(locale="pt-BR")
            page = await context.new_page()
            cv_page = await _abrir_curriculo(page, nome)
            await cv_page.wait_for_load_state("domcontentloaded")
            titulo_pagina = await cv_page.title()
            texto_visivel = await cv_page.locator("body").inner_text(timeout=10000)
            html_completo = await cv_page.content()
            url_final = cv_page.url
            dados = _extrair_dados(texto_visivel, url_final)
            dados["titulo_pagina"] = titulo_pagina
            dados["texto_visivel_extraido"] = texto_visivel
            dados["html_completo"] = html_completo
            return dados
        finally:
            await browser.close()
