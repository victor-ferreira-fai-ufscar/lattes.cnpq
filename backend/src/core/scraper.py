import os
import re
from asyncio import to_thread
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from urllib.parse import urljoin

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

from ..libs.nomes import (
    gerar_variacoes_nome_busca,
    normalizar,
    remover_acentos,
)

FIRST_URL = "https://lattes.cnpq.br/"
_BASE_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar"


@dataclass(frozen=True)
class LattesScrapeResult:
    pdf_bytes: bytes
    ultima_atualizacao: date
    html_text: str = ""
    html_source: str = ""
    photo_bytes: bytes | None = None
    photo_content_type: str | None = None


@dataclass(frozen=True)
class LattesProfileAssetsResult:
    ultima_atualizacao: date
    html_text: str
    html_source: str = ""
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
    texto_pdf: str = ""
    texto_html: str = ""


def _is_true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Aliases dos helpers de nome, hoje em libs/nomes.py para serem compartilhados
# com o enriquecimento externo. Mantidos com o nome antigo porque são usados em
# todo o módulo (e nos testes) como parte do vocabulário do scraper.
_normalizar = normalizar
_remover_acentos = remover_acentos
_gerar_variacoes_nome_busca = gerar_variacoes_nome_busca


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


def _detectar_content_type(body: bytes, fallback: str | None = None) -> str:
    """Detecta o MIME real pela assinatura dos bytes.

    O endpoint de foto do CNPQ costuma responder 'image/gif' mesmo quando a
    imagem é JPEG, então não dá para confiar no header da resposta.
    """
    if body[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if body[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if body[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    return fallback or "image/jpeg"


async def _baixar_foto_canonica(cv_page) -> tuple[bytes | None, str | None]:
    """Captura a foto oficial do currículo Lattes pela sua assinatura conhecida.

    No Lattes a foto do docente tem class="foto" e é servida pelo endpoint
    'servletrecuperafoto'. Quando presente, baixamos os bytes originais (que têm
    resolução cheia, melhor que um screenshot do elemento renderizado).
    """
    foto_loc = cv_page.locator(
        "img.foto, img[src*='servletrecuperafoto']"
    ).first
    try:
        if await foto_loc.count() == 0:
            return None, None

        src = await foto_loc.get_attribute("src")
        if src:
            full_src = urljoin(cv_page.url, src)
            try:
                resp = await cv_page.context.request.get(full_src, timeout=15000)
                if resp.ok:
                    body = await resp.body()
                    if body:
                        content_type = _detectar_content_type(
                            body, resp.headers.get("content-type")
                        )
                        return body, content_type
            except Exception:
                pass

        # Fallback: screenshot do próprio elemento da foto.
        await foto_loc.scroll_into_view_if_needed(timeout=5000)
        shot = await foto_loc.screenshot(type="png")
        if shot:
            return shot, "image/png"
    except Exception:
        return None, None

    return None, None


async def _capturar_foto_perfil(cv_page) -> tuple[bytes | None, str | None]:
    # Caminho preferencial: foto canônica do Lattes.
    foto_bytes, content_type = await _baixar_foto_canonica(cv_page)
    if foto_bytes:
        return foto_bytes, content_type

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
        # NÃO penalizar por "cnpq"/"lattes": a própria foto do docente é servida
        # de servicosweb.cnpq.br. Penalizamos apenas elementos decorativos.
        if any(
            token in contexto
            for token in [
                "logo",
                "marca",
                "banner",
                "captcha",
                "icon",
                "icone",
            ]
        ):
            penalidades += 12000

        # Sinal forte: foto oficial do currículo (class="foto" / servletrecuperafoto).
        bonus_foto = (
            1_000_000
            if ("foto" in contexto or "servletrecuperafoto" in contexto)
            else 0
        )

        razao_retrato = altura / largura if largura else 0
        bonus_retrato = 3000 if 0.9 <= razao_retrato <= 1.6 else 0
        bonus_topo = max(0.0, 800.0 - abs(float(candidato.get("top") or 0) - 220.0))
        score = (
            (largura * altura) + bonus_foto + bonus_retrato + bonus_topo - penalidades
        )

        candidato["_score"] = score

    # Tenta capturar do melhor para o pior, caindo para o próximo se o screenshot falhar.
    ordenados = sorted(
        (c for c in candidatos if c.get("visible") and "_score" in c),
        key=lambda c: c["_score"],
        reverse=True,
    )

    for candidato in ordenados:
        try:
            alvo = imagens.nth(int(candidato.get("index") or 0))
            await alvo.scroll_into_view_if_needed(timeout=5000)
            foto_bytes = await alvo.screenshot(type="png")
        except Exception:
            continue
        if foto_bytes:
            return foto_bytes, "image/png"

    return None, None


async def _coletar_assets_curriculo(cv_page) -> LattesProfileAssetsResult:
    texto_cv = await cv_page.locator("body").inner_text(timeout=12000)
    html_source = await cv_page.content()
    ultima_atualizacao = _extrair_ultima_atualizacao(texto_cv)
    photo_bytes, photo_content_type = await _capturar_foto_perfil(cv_page)
    return LattesProfileAssetsResult(
        ultima_atualizacao=ultima_atualizacao,
        html_text=texto_cv,
        html_source=html_source,
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
                html_source=assets.html_source,
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
                html_source=assets.html_source,
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


async def scrape_lattes_ultima_atualizacao(nome: str, href: str | None = None) -> date:
    """Consulta apenas a data de última atualização do currículo no Lattes."""
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
            texto_cv = await cv_page.locator("body").inner_text(timeout=12000)
            return _extrair_ultima_atualizacao(texto_cv)
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
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                )

            return LattesSummarySourceResult(
                texto=texto_html,
                fonte="html",
                caracteres_pdf=len(texto_pdf.strip()),
                caracteres_html=len(texto_html.strip()),
                texto_pdf=texto_pdf,
                texto_html=texto_html,
            )
        finally:
            await browser.close()
