import streamlit as st
import pandas as pd
import asyncio
import threading
import os
import io
import time
import logging
from typing import Optional, Callable

# Silencia avisos inofensivos do Streamlit que poluem o terminal
logging.getLogger("streamlit.runtime.scriptrunner").setLevel(logging.ERROR)
logging.getLogger("streamlit.runtime.scriptrunner_utils").setLevel(logging.ERROR)

from streamlit.runtime.scriptrunner import add_script_run_ctx
from src.scraper import scrape_lattes, gerar_resumo_ia
from src.document_maker import create_lattes_docx

# ── Configuração da Página ──────────────────────────────────────────
st.set_page_config(
    page_title="Lattes Automator AI",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS Customizado ─────────────────────────────────────────────────
st.markdown("""
<style>
    .main-header { text-align: center; padding: 1.5rem 0 0.5rem 0; }
    .main-header h1 {
        font-size: 2.6rem;
        background: linear-gradient(135deg, #4A90D9, #67B8F7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .result-card {
        background: #1A1F2B; border: 1px solid #2A3040; border-radius: 12px;
        padding: 1.2rem 1.5rem; margin-bottom: 1rem;
    }
    .result-card h4 { color: #67B8F7; margin: 0 0 0.5rem 0; font-size: 1rem; }
    .trajectory-badge {
        display: inline-block; background: #1e3a5f; color: #A8D0F0;
        padding: 0.4rem 0.8rem; border-radius: 8px; margin: 0.2rem; font-size: 0.85rem;
    }
    .stStatus { background-color: #0E1117 !important; border: 1px solid #2A3040 !important; }
</style>
""", unsafe_allow_html=True)

# ── Helpers de Concorrência ─────────────────────────────────────────

def run_async(coro):
    """Executa coroutine em uma thread dedicada com suporte a ProactorEventLoop no Windows."""
    result = {"data": None, "error": None}
    
    def _run():
        # No Windows, Playwright requer ProactorEventLoop para subprocessos
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result["data"] = loop.run_until_complete(coro)
            loop.close()
        except Exception as e:
            result["error"] = e

    thread = threading.Thread(target=_run)
    add_script_run_ctx(thread) # Permite que a thread acesse o contexto UI do Streamlit
    thread.start()
    thread.join()
    
    if result["error"]:
        raise result["error"]
    return result["data"]

# ── Lógica de Processamento ─────────────────────────────────────────

OUTPUT_RAW = "output/raw"
OUTPUT_DOCX = "output/structured"
os.makedirs(OUTPUT_RAW, exist_ok=True)
os.makedirs(OUTPUT_DOCX, exist_ok=True)

class StreamlitLogHandler:
    def __init__(self, status_container):
        self.container = status_container
        self.logs = []
    
    def log(self, message: str):
        self.logs.append(f"{time.strftime('%H:%M:%S')} - {message}")
        self.container.write("\n".join(self.logs))

async def processar_nome(nome: str, log_handler: StreamlitLogHandler, provedor: str, modelo: str, api_key: Optional[str] = None) -> tuple[dict | None, str | None, str | None]:
    """Processa um único nome com rastreamento (logs)."""
    try:
        # Scrape
        texto_bruto = await scrape_lattes(nome, log_callback=log_handler.log)
        
        # Salva raw
        raw_path = os.path.join(OUTPUT_RAW, f"{nome.replace(' ', '_')}_raw.txt")
        with open(raw_path, "w", encoding="utf-8") as f:
            f.write(texto_bruto)

        # IA Generativa (Roteador)
        dados = gerar_resumo_ia(texto_bruto, provedor, modelo, api_key=api_key, log_callback=log_handler.log)
        
        if not dados:
            return None, None, "A IA retornou um resultado vazio (None)."
        
        if isinstance(dados, dict) and "erro" in dados:
            return None, None, dados["erro"]

        # Docx
        log_handler.log("[*] Gerando documento Word (.docx)...")
        docx_path = create_lattes_docx(nome, dados, OUTPUT_DOCX)
        log_handler.log("[✓] Documento gerado com sucesso!")
        
        return dados, docx_path, None

    except Exception as e:
        return None, None, str(e)

def exibir_resultado(nome: str, dados: dict, docx_path: str):
    """Renderiza os resultados de forma visual."""
    if not dados or not isinstance(dados, dict):
        st.error(f"Erro ao processar dados de {nome}. Verifique os logs.")
        return
        
    st.markdown(f"### ✅ Resultado: {nome}")
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown(f"""
        <div class="result-card">
            <h4>📝 Resumo Executivo</h4>
            <p>{dados.get('resumo', 'Resumo não disponível.')}</p>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        vinculo = dados.get('vinculo_institucional', 'Não identificado.')
        st.markdown(f"""
        <div class="result-card">
            <h4>🏛️ Vínculo Institucional</h4>
            <p>{vinculo}</p>
        </div>
        <div class="result-card">
            <h4>🗺️ Trajetória Acadêmica</h4>
        """, unsafe_allow_html=True)
        
        for k, v in [('graduacao', '🎓 Graduação'), ('mestrado', '📘 Mestrado'), 
                     ('doutorado', '📕 Doutorado'), ('pos_doutorado', '🔬 Pós-Doc')]:
            val = dados.get(k, '')
            if val:
                st.markdown(f'<span class="trajectory-badge"><b>{v}:</b> {val}</span>', unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with open(docx_path, "rb") as f:
        st.download_button(
            label="📥 Baixar Relatório (.docx)",
            data=f,
            file_name=os.path.basename(docx_path),
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            key=f"dl_{nome}_{time.time()}"
        )

# ── Interface Principal ─────────────────────────────────────────────

st.markdown('<div class="main-header"><h1>🎓 Lattes Automator AI</h1><p>Automação e Resumo de Currículos Lattes</p></div>', unsafe_allow_html=True)

# ── Sidebar: Configuração e Ajuda ──────────────────────────────────
with st.sidebar:
    st.image("https://upload.wikimedia.org/wikipedia/commons/2/21/CNPq_logo.png", width=120)
    st.title("⚙️ Configurações")
    
    # Seleção de Provedor e Modelo
    st.subheader("🤖 Modelo de IA")
    provedor = st.selectbox("Provedor:", ["Google Gemini", "OpenAI"], index=0)
    
    if provedor == "Google Gemini":
        modelo = st.selectbox("Modelo:", ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], index=0)
        label_key = "Gemini API Key:"
        help_url = "https://aistudio.google.com/app/apikey"
    else:
        modelo = st.selectbox("Modelo:", ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"], index=1)
        label_key = "OpenAI API Key:"
        help_url = "https://platform.openai.com/api-keys"

    # Gerenciamento de Chave
    ui_api_key = st.text_input(
        label_key,
        type="password",
        placeholder="Cole sua chave aqui...",
        help=f"Sua chave do provedor selecionado. Ela tem prioridade sobre o arquivo .env."
    )
    
    if not ui_api_key:
        st.info("💡 Usando chave do sistema (.env).")
    else:
        st.success("🔑 Chave personalizada ativa!")
        
    st.divider()
    
    # Guia de Ajuda
    with st.expander("📖 Como usar?"):
        st.markdown(f"""
        1. **Provedor**: Escolha entre Google ou OpenAI.
        2. **Chave API**: Cole sua chave no campo acima.
        3. **Busca**: Digite o nome completo do docente.
        4. **Download**: Baixe o relatório em Word no final.
        
        ---
        **Precisa de uma chave?**
        [Obter chave aqui]({help_url})
        """)
        
    st.caption("Desenvolvido para automação acadêmica.")

tab1, tab2 = st.tabs(["🔍 Busca Individual", "📋 Processamento em Lote"])

# ── Aba 1: Individual ──────────────────────────────────────────────
with tab1:
    nome_input = st.text_input("Nome completo do docente:", placeholder="Ex: Neocles Juaçaba Júnior")
    if st.button("🚀 Iniciar Busca", type="primary"):
        if not nome_input.strip():
            st.warning("Digite um nome primeiro.")
        else:
            with st.status(f"🛠️ Processando: **{nome_input}**...", expanded=True) as status:
                handler = StreamlitLogHandler(status)
                try:
                    res = run_async(processar_nome(nome_input.strip(), handler, provedor=provedor, modelo=modelo, api_key=ui_api_key))
                    
                    if res and isinstance(res, tuple) and len(res) == 3:
                        dados, docx_path, erro = res
                        
                        if erro:
                            status.update(label=f"❌ Erro: {nome_input}", state="error")
                            st.error(f"Erro ao processar: {erro}")
                        elif dados and docx_path:
                            status.update(label=f"✅ Concluído: {nome_input}", state="complete", expanded=False)
                            exibir_resultado(nome_input, dados, docx_path)
                        else:
                            status.update(label=f"⚠️ {nome_input}", state="error")
                            st.warning("Não foi possível obter dados para este nome.")
                    else:
                        status.update(label="❓ Resposta inesperada", state="error")
                        st.error("O processamento não retornou o formato esperado.")
                except Exception as e:
                    status.update(label="❌ Falha crítica", state="error")
                    st.error(f"Ocorreu um erro inesperado: {str(e)}")

# ── Aba 2: Lote ────────────────────────────────────────────────────
with tab2:
    arquivo = st.file_uploader("Upload de lista (.txt ou .csv)", type=["txt", "csv"])
    if arquivo:
        # Extração de nomes
        if arquivo.name.endswith('.csv'):
            df = pd.read_csv(arquivo)
            nomes = df[df.columns[0]].dropna().tolist()
        else:
            nomes = [n.strip() for n in arquivo.getvalue().decode().splitlines() if n.strip()]
        
        st.info(f"Encontrados {len(nomes)} nomes para processar.")
        
        if st.button("🚀 Iniciar Lote", type="primary"):
            progress_bar = st.progress(0)
            log_area = st.expander("📄 Trace Route (Logs Detalhados)", expanded=True)
            
            sucessos = 0
            for i, nome in enumerate(nomes):
                progress_bar.progress((i)/len(nomes), text=f"Processando [{i+1}/{len(nomes)}]: {nome}")
                
                with st.status(f"🔄 Docente {i+1}: **{nome}**") as status:
                    handler = StreamlitLogHandler(status)
                    try:
                        res = run_async(processar_nome(nome, handler, provedor=provedor, modelo=modelo, api_key=ui_api_key))
                        dados, docx_path, erro = res
                        if erro:
                            status.update(label=f"❌ Falha: {nome}", state="error")
                            st.error(f"{nome}: {erro}")
                        else:
                            status.update(label=f"✅ Sucesso: {nome}", state="complete", expanded=False)
                            st.success(f"Relatório pronto para {nome}")
                            with open(docx_path, "rb") as f:
                                st.download_button(f"📥 Baixar {nome}", f, file_name=f"{nome}.docx", key=f"btn_{i}")
                            sucessos += 1
                    except Exception as e:
                        status.update(label=f"❌ Erro fatal: {nome}", state="error")
                        st.error(f"Erro em {nome}: {str(e)}")
            
            progress_bar.progress(1.0, text="Finalizado!")
            st.balloons()
            st.success(f"Concluído! {sucessos} de {len(nomes)} currículos processados.")
