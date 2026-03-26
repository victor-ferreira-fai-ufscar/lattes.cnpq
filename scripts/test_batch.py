import asyncio
import os
import sys

# Permite rodar o script de qualquer lugar resolvendo a raiz do projeto
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.scraper import scrape_lattes, gerar_resumo_gemini
from src.document_maker import create_lattes_docx

async def test():
    nomes = ["Neocles", "Andréa"]
    os.makedirs("output/raw", exist_ok=True)
    os.makedirs("output/structured", exist_ok=True)
    
    for nome in nomes:
        print(f"--- Processando {nome} ---")
        texto_bruto = await scrape_lattes(nome)
        
        raw_path = os.path.join("output/raw", f"{nome}_raw.txt")
        with open(raw_path, "w", encoding="utf-8") as f:
            f.write(texto_bruto)
            
        dados = gerar_resumo_gemini(texto_bruto)
        print("Dados:", dados)
        
        if "erro" not in dados:
            docx_path = create_lattes_docx(nome, dados, "output/structured")
            print(f"Docx salvo em {docx_path}")

if __name__ == "__main__":
    asyncio.run(test())
