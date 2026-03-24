import os
import asyncio
from playwright.async_api import async_playwright
from google import genai
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

# Carrega chaves da raiz do projeto (.env) se estiver rodando localmente
load_dotenv()
console = Console()

async def scrape_lattes(query_name: str) -> str:
    console.print(f"[bold cyan][*] Iniciando automação para buscar por '{query_name}'...[/]")
    async with async_playwright() as p:
        # Puxamos do .env, caso não exista, assume "false" para abrir a janela (não-headless) localmente
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
        # Espera carregar a lista de resultados
        await page.wait_for_selector(".resultado")
        
        console.print(f"[cyan][*] Clicando no primeiro resultado que contém '{query_name}'...[/]")
        # Clica no primeiro link que contenha o nome buscado
        primeiro_resultado = page.locator(".resultado a", has_text=query_name).first
        await primeiro_resultado.click()
        
        console.print("[cyan][*] Buscando link para 'Abrir Currículo'...[/]")
        # A janela lateral se abre, clicamos em 'Abrir Currículo'
        await page.wait_for_timeout(2000)
        btn_abrir = page.locator("#idbtnabrircurriculo")
        if await btn_abrir.count() == 0:
            btn_abrir = page.locator("a", has_text="Abrir Currículo").first
            
        await btn_abrir.wait_for(state="visible")
        
        # O botão abre em nova aba
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
        
        # LOG DA URL DO CURRÍCULO COMPLETO LOGO APÓS ABRIR
        console.print(f"\n[bold green][✓] Currículo acessado com sucesso na URL: {page_cv.url}[/]\n")
        
        console.print("[cyan][*] Extraindo texto do currículo Lattes...[/]")
        # Tenta pegar a div de resumo primeiro, se não tiver pega o texto todo
        try:
            resumo_element = page_cv.locator(".resumo")
            texto = await resumo_element.inner_text(timeout=5000)
            if not texto.strip():
                texto = await page_cv.locator("body").inner_text()
        except:
            texto = await page_cv.locator("body").inner_text()
            
        await browser.close()
        return texto

def gerar_resumo_gemini(texto: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "ERRO: Variável de ambiente GEMINI_API_KEY não foi definida. Defina-a no seu arquivo .env!"
        
    console.print("[cyan][*] Enviando texto gerado para a API do Gemini...[/]")
    client = genai.Client(api_key=api_key)
    
    prompt = (
        "Você é um assistente especialista em analisar perfis acadêmicos e profissionais. "
        "Abaixo está o texto extraído de um Currículo Lattes. "
        "Por favor, faça um resumo executivo bem estruturado (em português) usando formatação **Markdown** focando em:\n"
        "1. Área principal de atuação\n"
        "2. Formação acadêmica principal\n"
        "3. Realizações/Pesquisas mais importantes\n\n"
        "Currículo Lattes:\n"
        f"{texto[:30000]}"
    )
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return response.text

async def main():
    # Nome a ser buscado
    query = "Neocles"
    try:
        cv_text = await scrape_lattes(query)
        
        console.print("\n")
        console.print(Panel(
            f"{cv_text[:500]}...\n[...]",
            title="[yellow]Amostra dos Dados Coletados pelo Bot[/]",
            border_style="yellow",
            expand=False
        ))
        
        resumo = gerar_resumo_gemini(cv_text)
        
        if "ERRO:" in resumo:
            console.print(f"[bold red]{resumo}[/]")
        else:
            # Exibe o resumo de forma rica e elegante no terminal renderizando Markdown
            console.print("\n")
            console.print(Panel(
                Markdown(resumo),
                title="[bold blue]✨ Resumo Executivo Lattes (Gemini) ✨[/]",
                border_style="blue",
                padding=(1, 3),
                expand=True
            ))
            
    except Exception as e:
        console.print(f"\n[bold red][!] Ocorreu um erro durante a execução: {e}[/]")

if __name__ == "__main__":
    asyncio.run(main())
