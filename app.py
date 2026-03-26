import streamlit as st
import pandas as pd
import asyncio
import os
from src.scraper import scrape_lattes, gerar_resumo_gemini
from src.document_maker import create_lattes_docx

# Configuração da página inicial
st.set_page_config(page_title="Lattes Automator AI", page_icon="🎓", layout="wide")

st.title("🎓 Lattes Automator AI")
st.markdown("""
### Como utilizar:
1. Revise se sua **GEMINI_API_KEY** está configurada no `.env` (se local) ou injetada no Docker.
2. Faça o **upload** de um arquivo `.txt` (um nome por linha) ou `.csv` (com uma coluna `nome` ou `nome_completo`).
3. (Opcional) Ajuste as pastas de saída na barra lateral ou deixe os padrões.
4. Clique em **Iniciar Extração em Lote**. O robô irá abrir o navegador em modo fantasma, baixar os currículos, resumir usando IA e preencher os relatórios na pasta final!
""")

st.sidebar.header("📁 Configurações de Saída")
output_raw_dir = st.sidebar.text_input("Pasta Texto Bruto (Raw)", value="output/raw")
output_docx_dir = st.sidebar.text_input("Pasta Relatórios (Docx)", value="output/structured")

# Inicializa pastas
os.makedirs(output_raw_dir, exist_ok=True)
os.makedirs(output_docx_dir, exist_ok=True)

arquivo_lote = st.file_uploader("Selecione sua Lista de Docentes (.txt ou .csv)", type=["txt", "csv"])

if st.button("🚀 Iniciar Extração em Lote", type="primary"):
    if not arquivo_lote:
        st.error("Por favor, envie um arquivo primeiro!")
    else:
        nomes = []
        # Leitura do arquivo
        if arquivo_lote.name.endswith('.csv'):
            df = pd.read_csv(arquivo_lote)
            coluna_escolhida = None
            for col in df.columns:
                if 'nome' in col.lower():
                    coluna_escolhida = col
                    break
            if coluna_escolhida:
                nomes = df[coluna_escolhida].dropna().astype(str).tolist()
            else:
                st.error("Não encontrei uma coluna chamada 'nome' no CSV. Pegando a primeira coluna.")
                nomes = df.iloc[:, 0].dropna().astype(str).tolist()
        else: # TXT
            content = arquivo_lote.getvalue().decode("utf-8")
            nomes = [n.strip() for n in content.splitlines() if n.strip()]
            
        st.info(f"Foram encontrados {len(nomes)} docentes na lista.")
        
        # Cria as zonas de logging no terminal virtual do Streamlit
        log_container = st.empty()
        results_container = st.container()
        
        async def processar_lote(nomes_lista):
            sucessos = 0
            for i, nome in enumerate(nomes_lista):
                log_container.info(f"🔄 Processando [{i+1}/{len(nomes_lista)}]: {nome}...")
                
                try:
                    # 1. Scrape do texto
                    texto_bruto = await scrape_lattes(nome)
                    
                    # Salva raw text
                    raw_path = os.path.join(output_raw_dir, f"{nome.replace(' ', '_')}_raw.txt")
                    with open(raw_path, "w", encoding="utf-8") as f:
                        f.write(texto_bruto)
                        
                    # 2. IA Extract
                    log_container.warning(f"🤖 Extraindo via Gemini para {nome}...")
                    dados = gerar_resumo_gemini(texto_bruto)
                    
                    if "erro" in dados:
                        with results_container:
                            st.error(f"❌ Erro IA ({nome}): {dados['erro']}")
                        continue
                        
                    # 3. Gerar Docx
                    log_container.warning(f"📄 Criando relatório DOCX para {nome}...")
                    docx_path = create_lattes_docx(nome, dados, output_docx_dir)
                    
                    with results_container:
                        st.success(f"✅ Sucesso: **{nome}** -> Salvo em `{docx_path}` e `{raw_path}`.")
                    
                    sucessos += 1
                except Exception as e:
                    with results_container:
                        st.error(f"❌ Falha crítica ao buscar {nome}: {e}")
            
            return sucessos

        # Roda o event loop assíncrono para a fila
        with st.spinner("Robô operando! Por favor, aguarde..."):
            total_sucessos = asyncio.run(processar_lote(nomes))
            
        st.balloons()
        st.success(f"🎉 Finalizado! {total_sucessos} de {len(nomes)} currículos processados com êxito. Arquivos na pasta `output/`.")

