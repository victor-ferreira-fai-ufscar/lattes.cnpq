import os
import json
import asyncio
from playwright.async_api import async_playwright
from google import genai
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from rich.console import Console
from typing import Callable, Optional

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
            # Fallback if specific name is not an exact match but exists in the list
            primeiro_resultado = page.locator(".resultado a").first
            await primeiro_resultado.click()
        
        _log("[*] Buscando link para 'Abrir Currículo'...", log_callback)
        await page.wait_for_timeout(2000)
        
        # Tenta múltiplos seletores para o botão de abrir currículo
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
            # Tenta vários elementos de conteúdo comuns no Lattes
            for selector in [".resumo", "#id_resumo", ".corpo", "body"]:
                content = page_cv.locator(selector)
                if await content.count() > 0:
                    texto = await content.inner_text(timeout=5000)
                    if texto and len(texto.strip()) > 100:
                        break
        except Exception as e:
            _log(f"[!] Erro na extração detalhada: {str(e)}", log_callback, "yellow")
            texto = await page_cv.content() # Fallback total
            
        await browser.close()
        return texto

def gerar_resumo_gemini(texto: str, log_callback: Optional[Callable[[str], None]] = None, api_key: Optional[str] = None) -> dict:
    """Usa o Gemini para extrair e estruturar os dados do Lattes extraído em formato JSON."""
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
        
    if not api_key:
        return {"erro": "Nenhuma API Key encontrada. Por favor, insira uma na barra lateral ou no arquivo .env."}
        
    _log("[*] Enviando texto gerado para a API do Gemini...", log_callback)
    client = genai.Client(api_key=api_key)
    
    prompt = (
        "Você é um assistente especialista em analisar extrações de perfis acadêmicos do Currículo Lattes. "
        "Abaixo está o texto bruto extraído de um perfil. Você deve extrair informações específicas "
        "e respondê-las estritamente em formato JSON com as seguintes chaves:\n"
        "- 'graduacao': Onde fez graduação e qual o curso (seja conciso).\n"
        "- 'mestrado': Onde fez mestrado e qual o curso/tema (seja conciso).\n"
        "- 'doutorado': Onde fez doutorado e qual o curso/tema (seja conciso).\n"
        "- 'pos_doutorado': Onde fez pós-doutorado e instituição (seja conciso, deixe vazio se não houver).\n"
        "- 'vinculo_institucional': Instituições atuais/principais onde a pessoa trabalha hoje.\n"
        "- 'resumo': Um bom resumo executivo em 2 ou 3 parágrafos focando na atuação principal e pesquisas importantes.\n\n"
        "Se a pessoa não tiver alguma dessas formações, retorne uma string vazia '' naquela chave específica.\n"
        "Retorne APENAS o JSON válido. Nenhuma formatação extra markdown."
        "\n\nTexto Lattes:\n"
        f"{texto[:30000]}"
    )
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        if not response or not response.text:
            return {"erro": "A API do Gemini retornou uma resposta vazia."}
            
        data = json.loads(response.text)
        if not isinstance(data, dict):
            return {"erro": "A IA não retornou um objeto JSON válido."}
            
        return data
    except Exception as e:
        return {"erro": f"Erro na IA ao gerar JSON: {str(e)}"}

async def main():
    query = "Neocles"
    try:
        cv_text = await scrape_lattes(query)
        dados_estruturados = gerar_resumo_gemini(cv_text)
        print(json.dumps(dados_estruturados, indent=2, ensure_ascii=False))
    except Exception as e:
        console.print(f"\n[bold red][!] Ocorreu um erro durante a execução: {e}[/]")

if __name__ == "__main__":
    asyncio.run(main())
