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

console = Console()

async def scrape_lattes(query_name: str) -> str:
    """Extrai o texto bruto do currículo Lattes de um dado nome."""
    console.print(f"[bold cyan][*] Iniciando automação para buscar por '{query_name}'...[/]")
    async with async_playwright() as p:
        is_headless = os.environ.get("HEADLESS", "false").lower() == "true"
        browser = await p.chromium.launch(headless=is_headless)
        context = await browser.new_context()
        page = await context.new_page()

        console.print("[cyan][*] Acessando busca textual do Lattes...[/]")
        await page.goto("https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar")
        
        console.print("[cyan][*] Preenchendo formulário...[/]")
        await page.locator("input[name='textoBusca']").fill(query_name)
        await page.locator("#botaoBuscaFiltros").first.click()
        
        console.print("[cyan][*] Aguardando resultados...[/]")
        await page.wait_for_selector(".resultado")
        
        console.print(f"[cyan][*] Clicando no primeiro resultado que contém '{query_name}'...[/]")
        try:
            primeiro_resultado = page.locator(".resultado a", has_text=query_name).first
            await primeiro_resultado.click(timeout=5000)
        except Exception:
            # Fallback if specific name is not an exact match but exists in the list
            primeiro_resultado = page.locator(".resultado a").first
            await primeiro_resultado.click()
        
        console.print("[cyan][*] Buscando link para 'Abrir Currículo'...[/]")
        await page.wait_for_timeout(2000)
        btn_abrir = page.locator("#idbtnabrircurriculo")
        if await btn_abrir.count() == 0:
            btn_abrir = page.locator("a", has_text="Abrir Currículo").first
            
        await btn_abrir.wait_for(state="visible")
        
        console.print("[cyan][*] Clicando no botão e capturando a nova página gerada...[/]")
        try:
            async with context.expect_page(timeout=10000) as new_page_info:
                await btn_abrir.click()
            page_cv = await new_page_info.value
        except Exception:
            await btn_abrir.click(force=True)
            await page.wait_for_timeout(3000)
            page_cv = context.pages[-1] if len(context.pages) > 1 else page
            
        await page_cv.wait_for_load_state()
        
        console.print(f"\n[bold green][✓] Currículo acessado com sucesso na URL: {page_cv.url}[/]\n")
        
        console.print("[cyan][*] Extraindo texto do currículo Lattes...[/]")
        try:
            resumo_element = page_cv.locator(".resumo")
            texto = await resumo_element.inner_text(timeout=5000)
            if not texto.strip():
                texto = await page_cv.locator("body").inner_text()
        except:
            texto = await page_cv.locator("body").inner_text()
            
        await browser.close()
        return texto

def gerar_resumo_gemini(texto: str) -> dict:
    """Usa o Gemini para extrair e estruturar os dados do Lattes extraído em formato JSON."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"erro": "Variável de ambiente GEMINI_API_KEY não encontrada."}
        
    console.print("[cyan][*] Enviando texto gerado para a API do Gemini...[/]")
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
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        data = json.loads(response.text)
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
