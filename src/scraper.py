import os
import json
import asyncio
from playwright.async_api import async_playwright
from google import genai
from openai import OpenAI
from typing import Callable, Optional
from rich.console import Console

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

console = Console()

def _log(msg: str, callback: Optional[Callable[[str], None]] = None, style: str = "cyan"):
    """Helper para logar no console e via callback (Streamlit)."""
    rich_msg = f"[{style}]{msg}[/]"
    if "green" in style or "✓" in msg:
        rich_msg = f"[bold green]{msg}[/]"
    elif "red" in style or "!" in msg:
        rich_msg = f"[bold red]{msg}[/]"
    
    console.print(rich_msg)
    
    if callback:
        try:
            callback(msg)
        except:
            pass

async def scrape_lattes(query_name: str, log_callback: Optional[Callable[[str], None]] = None) -> str:
    """Extrai o texto bruto do currículo Lattes de um dado nome."""
    _log(f"[*] Iniciando automação para buscar por '{query_name}'...", log_callback, "bold cyan")
    async with async_playwright() as p:
        is_headless = os.environ.get("HEADLESS", "false").lower() == "true"
        browser = await p.chromium.launch(headless=is_headless)
        context = await browser.new_context()
        page = await context.new_page()

        _log("[*] Acessando busca textual do Lattes...", log_callback)
        await page.goto("https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar")
        
        _log("[*] Preenchendo formulário...", log_callback)
        await page.locator("input[name='textoBusca']").fill(query_name)
        await page.locator("#botaoBuscaFiltros").first.click()
        
        _log("[*] Aguardando resultados...", log_callback)
        await page.wait_for_selector(".resultado")
        
        _log(f"[*] Clicando no primeiro resultado que contém '{query_name}'...", log_callback)
        try:
            primeiro_resultado = page.locator(".resultado a", has_text=query_name).first
            await primeiro_resultado.click(timeout=5000)
        except Exception:
            primeiro_resultado = page.locator(".resultado a").first
            await primeiro_resultado.click()
        
        _log("[*] Buscando link para 'Abrir Currículo'...", log_callback)
        await page.wait_for_timeout(2000)
        
        btn_abrir = None
        for sel in ["#idbtnabrircurriculo", "input[value='Abrir Currículo']", "a:has-text('Abrir Currículo')", "text='Abrir Currículo'"]:
            try:
                if await page.locator(sel).count() > 0:
                    btn_abrir = page.locator(sel).first
                    break
            except:
                continue
        
        if not btn_abrir:
            raise Exception("Não foi possível encontrar o botão 'Abrir Currículo'. Verifique se o nome está correto.")
            
        await btn_abrir.wait_for(state="visible", timeout=10000)
        
        _log("[*] Clicando no botão e capturando o currículo...", log_callback)
        try:
            async with context.expect_page(timeout=15000) as new_page_info:
                await btn_abrir.click()
            page_cv = await new_page_info.value
        except Exception:
            _log("[!] Timeout ao abrir nova aba. Tentando fallback...", log_callback, "yellow")
            await btn_abrir.click(force=True)
            await page.wait_for_timeout(5000)
            page_cv = context.pages[-1] if len(context.pages) > 1 else page
            
        await page_cv.wait_for_load_state()
        
        _log(f"[✓] Currículo acessado: {page_cv.url[:50]}...", log_callback, "bold green")
        
        _log("[*] Extraindo texto do currículo...", log_callback)
        texto = ""
        try:
            for selector in [".resumo", "#id_resumo", ".corpo", "body"]:
                content = page_cv.locator(selector)
                if await content.count() > 0:
                    texto = await content.inner_text(timeout=5000)
                    if texto and len(texto.strip()) > 100:
                        break
        except Exception as e:
            _log(f"[!] Erro na extração detalhada: {str(e)}", log_callback, "yellow")
            texto = await page_cv.content()
            
        await browser.close()
        return texto

def gerar_resumo_ia(texto: str, provedor: str, modelo: str, api_key: Optional[str] = None, log_callback: Optional[Callable[[str], None]] = None) -> dict:
    """Roteador para gerar o resumo estruturado usando diferentes provedores de IA."""
    if provedor.lower() == "google gemini":
        return _gerar_resumo_gemini(texto, modelo, api_key, log_callback)
    elif provedor.lower() == "openai":
        return _gerar_resumo_openai(texto, modelo, api_key, log_callback)
    else:
        return {"erro": f"Provedor '{provedor}' não suportado."}

def _gerar_resumo_gemini(texto: str, modelo: str, api_key: Optional[str], log_callback: Optional[Callable[[str], None]]) -> dict:
    """Implementação para Google Gemini."""
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"erro": "Nenhuma chave (API Key) encontrada para o Google Gemini."}
        
    _log(f"[*] Enviando para Google Gemini ({modelo})...", log_callback)
    try:
        client = genai.Client(api_key=api_key)
        prompt = _get_prompt(texto)
        response = client.models.generate_content(
            model=modelo,
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        return {"erro": f"Erro no Gemini: {str(e)}"}

def _gerar_resumo_openai(texto: str, modelo: str, api_key: Optional[str], log_callback: Optional[Callable[[str], None]]) -> dict:
    """Implementação para OpenAI (GPT-4o, etc)."""
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"erro": "Nenhuma chave (API Key) encontrada para a OpenAI."}
        
    _log(f"[*] Enviando para OpenAI ({modelo})...", log_callback)
    try:
        client = OpenAI(api_key=api_key)
        prompt = _get_prompt(texto)
        response = client.chat.completions.create(
            model=modelo,
            messages=[
                {"role": "system", "content": "Você é um assistente especialista em analisar perfis acadêmicos do Lattes. Retorne APENAS JSON válido conforme solicitado."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        return {"erro": f"Erro na OpenAI: {str(e)}"}

def _get_prompt(texto: str) -> str:
    """Centraliza o prompt para garantir consistência entre modelos."""
    return (
        "Com base no texto bruto de um Currículo Lattes abaixo, extraia as seguintes informações estritamente em formato JSON:\n"
        "- 'graduacao': Onde e qual curso (conciso)\n"
        "- 'mestrado': Onde e qual curso/tema (conciso)\n"
        "- 'doutorado': Onde e qual curso/tema (conciso)\n"
        "- 'pos_doutorado': Onde e qual instituição (opcional)\n"
        "- 'vinculo_institucional': Instituição atual de trabalho\n"
        "- 'resumo': Um resumo executivo de 2-3 parágrafos sobre a trajetória e pesquisa.\n\n"
        "Se não houver alguma informação, deixe o campo como string vazia.\n"
        "Retorne apenas o JSON puro.\n\n"
        "Texto Lattes:\n"
        f"{texto[:20000]}"
    )

if __name__ == "__main__":
    # Teste rápido se rodado diretamente
    async def test():
        t = "Texto de teste para o currículo."
        # res = gerar_resumo_ia(t, "Google Gemini", "gemini-2.0-flash")
        # print(res)
    asyncio.run(test())
