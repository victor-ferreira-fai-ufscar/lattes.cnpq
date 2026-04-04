import os
import re
import unicodedata
from asyncio import to_thread
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

FIRST_URL = "https://lattes.cnpq.br/"
_BASE_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar"


@dataclass(frozen=True)
class LattesScrapeResult:
    pdf_bytes: bytes
    ultima_atualizacao: date
    html_text: str = ""
    photo_bytes: bytes | None = None
    photo_content_type: str | None = None


@dataclass(frozen=True)
class LattesProfileAssetsResult:
    ultima_atualizacao: date
    html_text: str
    photo_bytes: bytes | None = None
    photo_content_type: str | None = None


@dataclass(frozen=True)
class LattesSearchCandidate:
    nome: str
    href: str


@dataclass(frozen=True)
class LattesSummarySourceResult:
    texto: str
    fonte: str
    caracteres_pdf: int
    caracteres_html: int


def _is_true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalizar(texto: str) -> str:
    return " ".join(texto.lower().split())


def _remover_acentos(texto: str) -> str:
    texto_norm = unicodedata.normalize("NFD", texto)
    return "".join(ch for ch in texto_norm if unicodedata.category(ch) != "Mn")


def _gerar_variacoes_nome_busca(nome: str) -> list[str]:
    nome_limpo = " ".join(nome.split())
    if not nome_limpo:
        return []

    partes = nome_limpo.split()
    variacoes = [
        nome_limpo,
        _remover_acentos(nome_limpo),
        nome_limpo.lower(),
        _remover_acentos(nome_limpo).lower(),
        nome_limpo.title(),
    ]

    if len(partes) >= 2:
        variacoes.append(f"{partes[0]} {partes[-1]}")
        variacoes.append(partes[0])

    unicos: list[str] = []
    vistos: set[str] = set()
    for variacao in variacoes:
        texto = " ".join(variacao.split())
        chave = _normalizar(texto)
        if not texto or chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(texto)

    return unicos


def _parece_sem_resultado(texto: str) -> bool:
    texto_norm = _normalizar(texto)
    sinais_sem_resultado = [
        "nenhum resultado encontrado",
        "nenhum curriculo foi encontrado",
        "nenhum currículo foi encontrado",
        "resultado de 0",
    ]
    return any(sinal in texto_norm for sinal in sinais_sem_resultado)


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


def _pontuar_texto_curriculo(texto: str) -> int:
    texto_norm = _normalizar(texto)
    sinais = [
        "ultima atualização do currículo",
        "última atualização do currículo",
        "resumo informado pelo autor",
        "formação acadêmica/titulação",
        "atuação profissional",
        "produção bibliográfica",
        "orientações concluídas",
        "projetos de pesquisa",
    ]
    return sum(1 for sinal in sinais if sinal in texto_norm)


def _pdf_parece_completo(texto_pdf: str, texto_html: str) -> bool:
    pdf_limpo = texto_pdf.strip()
    html_limpo = texto_html.strip()
    if not pdf_limpo:
        return False

    if not html_limpo:
        return True

    pdf_chars = len(pdf_limpo)
    html_chars = len(html_limpo)
    score_pdf = _pontuar_texto_curriculo(pdf_limpo)
    score_html = _pontuar_texto_curriculo(html_limpo)

    if pdf_chars < 1200:
        return False

    if score_pdf >= score_html:
        return True

    return pdf_chars >= max(1200, int(html_chars * 0.35)) and score_pdf >= 2


def _extrair_texto_pdf_bytes(pdf_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception:
        return ""

    paginas: list[str] = []
    for page in reader.pages:
        try:
            texto_pagina = page.extract_text() or ""
        except Exception:
            continue
        texto_pagina = texto_pagina.strip()
        if texto_pagina:
            paginas.append(texto_pagina)

    return "\n\n".join(paginas).strip()


def _extrair_ultima_atualizacao(texto: str) -> date:
    # Exemplo esperado: "Última atualização do currículo em 11/09/2020"
    match = re.search(
        r"[uú]ltima\s+atualiza(?:c|ç)[aã]o\s+do\s+curr[íi]culo\s+em\s+(\d{2}/\d{2}/\d{4})",
        _normalizar(texto),
    )
    if not match:
        raise ValueError(
            "Não foi possível identificar a data de atualização do currículo."
        )

    return datetime.strptime(match.group(1), "%d/%m/%Y").date()


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


async def _capturar_foto_perfil(cv_page) -> tuple[bytes | None, str | None]:
    imagens = cv_page.locator("img")
    total_imagens = await imagens.count()
    if total_imagens == 0:
        return None, None

    try:
        candidatos = await imagens.evaluate_all(
            """
            (elements) => elements.map((element, index) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              return {
                index,
                width: rect.width || element.naturalWidth || 0,
                height: rect.height || element.naturalHeight || 0,
                top: rect.top || 0,
                left: rect.left || 0,
                src: element.currentSrc || element.src || "",
                alt: (element.alt || "").toLowerCase(),
                className: String(element.className || "").toLowerCase(),
                id: String(element.id || "").toLowerCase(),
                visible:
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  style.opacity !== "0" &&
                  (rect.width || element.naturalWidth || 0) >= 48 &&
                  (rect.height || element.naturalHeight || 0) >= 48,
              };
            })
            """
        )
    except Exception:
        return None, None

    melhor_indice: int | None = None
    melhor_score = float("-inf")

    for candidato in candidatos:
        if not candidato.get("visible"):
            continue

        largura = float(candidato.get("width") or 0)
        altura = float(candidato.get("height") or 0)
        if largura <= 0 or altura <= 0:
            continue

        contexto = " ".join(
            [
                str(candidato.get("src") or "").lower(),
                str(candidato.get("alt") or "").lower(),
                str(candidato.get("className") or "").lower(),
                str(candidato.get("id") or "").lower(),
            ]
        )

        penalidades = 0.0
        if any(
            token in contexto
            for token in [
                "logo",
                "marca",
                "banner",
                "captcha",
                "icon",
                "icone",
                "lattes",
                "cnpq",
            ]
        ):
            penalidades += 12000

        razao_retrato = altura / largura if largura else 0
        bonus_retrato = 3000 if 0.9 <= razao_retrato <= 1.6 else 0
        bonus_topo = max(0.0, 800.0 - abs(float(candidato.get("top") or 0) - 220.0))
        score = (largura * altura) + bonus_retrato + bonus_topo - penalidades

        if score > melhor_score:
            melhor_score = score
            melhor_indice = int(candidato.get("index") or 0)

    if melhor_indice is None:
        return None, None

    try:
        alvo = imagens.nth(melhor_indice)
        await alvo.scroll_into_view_if_needed(timeout=5000)
        foto_bytes = await alvo.screenshot(type="png")
    except Exception:
        return None, None

    if not foto_bytes:
        return None, None

    return foto_bytes, "image/png"


async def _coletar_assets_curriculo(cv_page) -> LattesProfileAssetsResult:
    texto_cv = await cv_page.locator("body").inner_text(timeout=12000)
    ultima_atualizacao = _extrair_ultima_atualizacao(texto_cv)
    photo_bytes, photo_content_type = await _capturar_foto_perfil(cv_page)
    return LattesProfileAssetsResult(
        ultima_atualizacao=ultima_atualizacao,
        html_text=texto_cv,
        photo_bytes=photo_bytes,
        photo_content_type=photo_content_type,
    )


async def _executar_busca(page, nome: str):
    tentativas = _gerar_variacoes_nome_busca(nome)
    if not tentativas:
        raise ValueError("Nenhum resultado encontrado para o nome informado.")

    last_error = None
    for nome_tentativa in tentativas:
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

        await page.locator("input[name='textoBusca']").fill(nome_tentativa)

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
        await page.wait_for_timeout(900)

        links = page.locator(".resultado a")
        total = 0
        sem_resultado = False
        for _ in range(5):
            total = await links.count()
            if total > 0:
                break

            texto_body = await page.locator("body").inner_text(timeout=12000)
            if _parece_sem_resultado(texto_body):
                sem_resultado = True
                break

            await page.wait_for_timeout(700)

        if total > 0:
            return links, total

    raise ValueError(
        "Nenhum resultado encontrado para o nome informado. "
        "Tente sem acentos, com nome e sobrenome, ou apenas o primeiro nome."
    )


async def _abrir_curriculo(page, nome: str, href_alvo: str | None = None):
    links, total = await _executar_busca(page, nome)

    alvo = None
    nome_norm = _normalizar(nome)
    if href_alvo:
        href_alvo_norm = href_alvo.strip()
        for i in range(total):
            href = await links.nth(i).get_attribute("href")
            if href and href.strip() == href_alvo_norm:
                alvo = links.nth(i)
                break

    if alvo is None:
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


async def buscar_lattes_candidatos(
    nome: str, limit: int = 20
) -> list[LattesSearchCandidate]:
    """Retorna os candidatos encontrados na busca do Lattes para um nome."""
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
            links, total = await _executar_busca(page, nome)

            vistos: set[tuple[str, str]] = set()
            candidatos: list[LattesSearchCandidate] = []
            for i in range(total):
                if len(candidatos) >= max(limit, 1):
                    break

                link = links.nth(i)
                texto = (await link.inner_text()).strip()
                href = (await link.get_attribute("href") or "").strip()
                if not texto or not href:
                    continue

                chave = (_normalizar(texto), href)
                if chave in vistos:
                    continue

                vistos.add(chave)
                candidatos.append(LattesSearchCandidate(nome=texto, href=href))

            if not candidatos:
                raise ValueError("Nenhum resultado encontrado para o nome informado.")

            return candidatos
        finally:
            await browser.close()


async def scrape_lattes(nome: str) -> LattesScrapeResult:
    """Faz download do PDF do currículo e extrai a data de última atualização."""
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
            assets = await _coletar_assets_curriculo(cv_page)
            pdf_bytes = await cv_page.pdf(format="A4")
            return LattesScrapeResult(
                pdf_bytes=pdf_bytes,
                ultima_atualizacao=assets.ultima_atualizacao,
                html_text=assets.html_text,
                photo_bytes=assets.photo_bytes,
                photo_content_type=assets.photo_content_type,
            )
        finally:
            await browser.close()


async def scrape_lattes_by_href(nome: str, href: str) -> LattesScrapeResult:
    """Faz download do PDF do currículo a partir de um candidato já selecionado."""
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
            cv_page = await _abrir_curriculo(page, nome, href_alvo=href)
            await cv_page.wait_for_load_state("domcontentloaded")
            assets = await _coletar_assets_curriculo(cv_page)
            pdf_bytes = await cv_page.pdf(format="A4")
            return LattesScrapeResult(
                pdf_bytes=pdf_bytes,
                ultima_atualizacao=assets.ultima_atualizacao,
                html_text=assets.html_text,
                photo_bytes=assets.photo_bytes,
                photo_content_type=assets.photo_content_type,
            )
        finally:
            await browser.close()


async def scrape_lattes_profile_assets_by_href(
    nome: str, href: str
) -> LattesProfileAssetsResult:
    """Extrai HTML e foto do currículo a partir de um candidato já selecionado."""
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
            cv_page = await _abrir_curriculo(page, nome, href_alvo=href)
            await cv_page.wait_for_load_state("domcontentloaded")
            return await _coletar_assets_curriculo(cv_page)
        finally:
            await browser.close()


async def scrape_lattes_text(nome: str) -> str:
    """Retorna apenas o texto bruto do currículo Lattes (sem gerar PDF)."""
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
            return await cv_page.locator("body").inner_text(timeout=12000)
        finally:
            await browser.close()


async def scrape_lattes_summary_source(nome: str) -> LattesSummarySourceResult:
    """Coleta texto priorizando o PDF do currículo e usa HTML como fallback."""
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

            texto_html = await cv_page.locator("body").inner_text(timeout=12000)
            texto_pdf = ""

            try:
                pdf_bytes = await cv_page.pdf(format="A4")
                texto_pdf = await to_thread(_extrair_texto_pdf_bytes, pdf_bytes)
            except Exception:
                texto_pdf = ""

            if _pdf_parece_completo(texto_pdf, texto_html):
                return LattesSummarySourceResult(
                    texto=texto_pdf,
                    fonte="pdf",
                    caracteres_pdf=len(texto_pdf.strip()),
                    caracteres_html=len(texto_html.strip()),
                )

            return LattesSummarySourceResult(
                texto=texto_html,
                fonte="html",
                caracteres_pdf=len(texto_pdf.strip()),
                caracteres_html=len(texto_html.strip()),
            )
        finally:
            await browser.close()
