import asyncio
import logging
import os
import threading
import time
from typing import Optional

import pandas as pd
import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

from src.document_maker import create_lattes_docx
from src.scraper import (
    CurriculoNaoEncontradoError,
    DocenteNaoEncontradoError,
    ExtracaoCurriculoError,
    gerar_resumo_ia,
    scrape_lattes,
)

# Silencia avisos inofensivos do Streamlit que poluem o terminal
logging.getLogger("streamlit.runtime.scriptrunner").setLevel(logging.ERROR)
logging.getLogger("streamlit.runtime.scriptrunner_utils").setLevel(logging.ERROR)

st.set_page_config(
    page_title="Lattes Automator AI",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
    .main-header { text-align: center; padding: 1.25rem 0 0.5rem 0; }
    .main-header h1 {
        font-size: 2.6rem;
        background: linear-gradient(135deg, #4A90D9, #67B8F7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        margin-bottom: 1rem;
        padding: 0.85rem 1rem;
        border: 1px solid #2A3040;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(74, 144, 217, 0.14), rgba(26, 31, 43, 0.9));
    }
    .sidebar-brand img {
        width: 54px;
        height: auto;
        object-fit: contain;
    }
    .sidebar-brand strong {
        display: block;
        color: #F5F9FF;
        font-size: 1rem;
        margin-bottom: 0.1rem;
    }
    .sidebar-brand span {
        color: #A8D0F0;
        font-size: 0.88rem;
    }
    .result-card {
        background: #1A1F2B;
        border: 1px solid #2A3040;
        border-radius: 12px;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1rem;
    }
    .result-card h4 { color: #67B8F7; margin: 0 0 0.5rem 0; font-size: 1rem; }
    .trajectory-badge {
        display: inline-block;
        background: #1E3A5F;
        color: #A8D0F0;
        padding: 0.4rem 0.8rem;
        border-radius: 8px;
        margin: 0.2rem;
        font-size: 0.85rem;
    }
    .stStatus {
        background-color: #0E1117 !important;
        border: 1px solid #2A3040 !important;
    }
    [data-testid="collapsedControl"] {
        border-radius: 999px;
        background: rgba(74, 144, 217, 0.18);
        border: 1px solid rgba(103, 184, 247, 0.2);
    }
</style>
""",
    unsafe_allow_html=True,
)


def init_session_state() -> None:
    defaults = {
        "individual_result": None,
        "individual_docx_path": None,
        "individual_error": None,
        "individual_logs": [],
        "individual_name": "",
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def clear_individual_state() -> None:
    st.session_state["individual_result"] = None
    st.session_state["individual_docx_path"] = None
    st.session_state["individual_error"] = None
    st.session_state["individual_logs"] = []
    st.session_state["individual_name"] = ""


def run_async(coro):
    """Executa coroutine em uma thread dedicada com suporte a ProactorEventLoop no Windows."""
    result = {"data": None, "error": None}

    def _run():
        if os.name == "nt":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result["data"] = loop.run_until_complete(coro)
            loop.close()
        except Exception as exc:
            result["error"] = exc

    thread = threading.Thread(target=_run)
    add_script_run_ctx(thread)
    thread.start()
    thread.join()

    if result["error"]:
        raise result["error"]
    return result["data"]


OUTPUT_RAW = "output/raw"
OUTPUT_DOCX = "output/structured"
os.makedirs(OUTPUT_RAW, exist_ok=True)
os.makedirs(OUTPUT_DOCX, exist_ok=True)


class StreamlitLogHandler:
    def __init__(self, status_container):
        self.container = status_container
        self.logs: list[str] = []

    def log(self, message: str):
        self.logs.append(f"{time.strftime('%H:%M:%S')} - {message}")
        self.container.write("\n".join(self.logs))


async def processar_nome(
    nome: str,
    log_handler: StreamlitLogHandler,
    provedor: str,
    modelo: str,
    api_key: Optional[str] = None,
    headless: Optional[bool] = None,
) -> tuple[dict | None, str | None, str | None]:
    """Processa um único nome com rastreamento (logs)."""
    try:
        texto_bruto = await scrape_lattes(
            nome,
            log_callback=log_handler.log,
            headless=headless,
        )

        raw_path = os.path.join(OUTPUT_RAW, f"{nome.replace(' ', '_')}_raw.txt")
        with open(raw_path, "w", encoding="utf-8") as file:
            file.write(texto_bruto)

        dados = gerar_resumo_ia(
            texto_bruto,
            provedor,
            modelo,
            api_key=api_key,
            log_callback=log_handler.log,
        )

        if not dados:
            return None, None, "A IA retornou um resultado vazio."

        if isinstance(dados, dict) and "erro" in dados:
            return None, None, dados["erro"]

        log_handler.log("[*] Gerando documento Word (.docx)...")
        docx_path = create_lattes_docx(nome, dados, OUTPUT_DOCX)
        log_handler.log("[✓] Documento gerado com sucesso!")
        return dados, docx_path, None

    except DocenteNaoEncontradoError as exc:
        return None, None, str(exc)
    except CurriculoNaoEncontradoError as exc:
        return None, None, str(exc)
    except ExtracaoCurriculoError as exc:
        return None, None, str(exc)
    except Exception as exc:
        return None, None, f"Falha inesperada ao processar '{nome}': {exc}"


def exibir_resultado(nome: str, dados: dict, docx_path: str):
    """Renderiza os resultados de forma visual."""
    if not dados or not isinstance(dados, dict):
        st.error(f"Erro ao processar dados de {nome}. Verifique os logs.")
        return

    st.markdown(f"### Resultado: {nome}")
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown(
            f"""
        <div class="result-card">
            <h4>Resumo Executivo</h4>
            <p>{dados.get('resumo', 'Resumo não disponível.')}</p>
        </div>
        """,
            unsafe_allow_html=True,
        )

    with col2:
        vinculo = dados.get("vinculo_institucional", "Não identificado.")
        st.markdown(
            f"""
        <div class="result-card">
            <h4>Vínculo Institucional</h4>
            <p>{vinculo}</p>
        </div>
        <div class="result-card">
            <h4>Trajetória Acadêmica</h4>
        """,
            unsafe_allow_html=True,
        )

        for key, label in [
            ("graduacao", "Graduação"),
            ("mestrado", "Mestrado"),
            ("doutorado", "Doutorado"),
            ("pos_doutorado", "Pós-Doc"),
        ]:
            valor = dados.get(key, "")
            if valor:
                st.markdown(
                    f'<span class="trajectory-badge"><b>{label}:</b> {valor}</span>',
                    unsafe_allow_html=True,
                )
        st.markdown("</div>", unsafe_allow_html=True)

    with open(docx_path, "rb") as file:
        st.download_button(
            label="Baixar relatório (.docx)",
            data=file,
            file_name=os.path.basename(docx_path),
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            key=f"dl_{nome.replace(' ', '_')}",
        )


init_session_state()

st.markdown(
    '<div class="main-header"><h1>Lattes Automator AI</h1><p>Automação e resumo de currículos Lattes</p></div>',
    unsafe_allow_html=True,
)

with st.sidebar:
    st.markdown(
        """
        <div class="sidebar-brand">
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/21/CNPq_logo.png" alt="CNPq">
            <div>
                <strong>Painel da Automação</strong>
                <span>Configurações da coleta e da IA</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.subheader("Modelo de IA")
    provedor = st.selectbox(
        "Provedor",
        ["Google Gemini", "OpenAI"],
        index=0,
        key="provedor",
    )

    if provedor == "Google Gemini":
        modelo = st.selectbox(
            "Modelo",
            ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
            index=0,
            key="modelo_gemini",
        )
        label_key = "Gemini API Key"
        help_url = "https://aistudio.google.com/app/apikey"
    else:
        modelo = st.selectbox(
            "Modelo",
            ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
            index=1,
            key="modelo_openai",
        )
        label_key = "OpenAI API Key"
        help_url = "https://platform.openai.com/api-keys"

    ui_api_key = st.text_input(
        label_key,
        type="password",
        placeholder="Cole sua chave aqui...",
        help="A chave informada na interface tem prioridade sobre o arquivo .env.",
        key="ui_api_key",
    )

    if not ui_api_key:
        st.info("Usando chave do sistema (.env), se existir.")
    else:
        st.success("Chave personalizada ativa.")

    mostrar_navegador = st.toggle(
        "Mostrar automação navegando",
        value=False,
        help="Quando ativado, o navegador do Playwright fica visível durante a busca.",
        key="show_browser",
    )
    st.caption(
        "Modo atual: navegador visível."
        if mostrar_navegador
        else "Modo atual: execução silenciosa em segundo plano."
    )

    st.divider()

    with st.expander("Como usar"):
        st.markdown(
            f"""
            1. Escolha o provedor e o modelo de IA.
            2. Informe a chave API ou use o `.env`.
            3. Ative a visualização do navegador se quiser acompanhar a automação.
            4. Faça a busca individual ou envie um arquivo `.txt`/`.csv`.

            Precisa de uma chave? [Obter aqui]({help_url})
            """
        )

    st.caption("Desenvolvido para automação acadêmica.")

tab1, tab2 = st.tabs(["Busca Individual", "Processamento em Lote"])

with tab1:
    with st.form("form_busca_individual", clear_on_submit=False):
        nome_input = st.text_input(
            "Nome completo do docente",
            placeholder="Ex: Neocles Juaçaba Júnior",
            key="nome_docente",
        )
        col_busca, col_limpar = st.columns([3, 1])
        buscar = col_busca.form_submit_button("Iniciar busca", type="primary")
        limpar = col_limpar.form_submit_button("Limpar")

    if limpar:
        clear_individual_state()

    if buscar:
        nome = nome_input.strip()
        clear_individual_state()

        if not nome:
            st.session_state["individual_error"] = "Digite um nome antes de iniciar a busca."
        else:
            with st.status(f"Processando: **{nome}**...", expanded=True) as status:
                handler = StreamlitLogHandler(status)
                dados, docx_path, erro = run_async(
                    processar_nome(
                        nome,
                        handler,
                        provedor=provedor,
                        modelo=modelo,
                        api_key=ui_api_key,
                        headless=not mostrar_navegador,
                    )
                )

                st.session_state["individual_name"] = nome
                st.session_state["individual_logs"] = handler.logs.copy()

                if erro:
                    status.update(label=f"Erro ao processar: {nome}", state="error")
                    st.session_state["individual_error"] = erro
                elif dados and docx_path:
                    status.update(label=f"Concluído: {nome}", state="complete", expanded=False)
                    st.session_state["individual_result"] = dados
                    st.session_state["individual_docx_path"] = docx_path
                else:
                    status.update(label=f"Sem dados para: {nome}", state="error")
                    st.session_state["individual_error"] = (
                        "Não foi possível montar o resultado para esse docente."
                    )

    if st.session_state["individual_error"]:
        st.error(st.session_state["individual_error"])

    if st.session_state["individual_result"] and st.session_state["individual_docx_path"]:
        exibir_resultado(
            st.session_state["individual_name"],
            st.session_state["individual_result"],
            st.session_state["individual_docx_path"],
        )

    if st.session_state["individual_logs"]:
        with st.expander("Trace Route da última busca", expanded=False):
            st.code("\n".join(st.session_state["individual_logs"]), language="text")

with tab2:
    arquivo = st.file_uploader("Upload de lista (.txt ou .csv)", type=["txt", "csv"])
    if arquivo:
        if arquivo.name.endswith(".csv"):
            dataframe = pd.read_csv(arquivo)
            nomes = dataframe[dataframe.columns[0]].dropna().astype(str).tolist()
        else:
            nomes = [nome.strip() for nome in arquivo.getvalue().decode().splitlines() if nome.strip()]

        st.info(f"Encontrados {len(nomes)} nomes para processar.")

        if st.button("Iniciar lote", type="primary"):
            progress_bar = st.progress(0)
            sucessos = 0

            for index, nome in enumerate(nomes):
                progress_bar.progress(
                    index / len(nomes),
                    text=f"Processando [{index + 1}/{len(nomes)}]: {nome}",
                )

                with st.status(f"Docente {index + 1}: **{nome}**", expanded=False) as status:
                    handler = StreamlitLogHandler(status)
                    dados, docx_path, erro = run_async(
                        processar_nome(
                            nome,
                            handler,
                            provedor=provedor,
                            modelo=modelo,
                            api_key=ui_api_key,
                            headless=not mostrar_navegador,
                        )
                    )
                    if erro:
                        status.update(label=f"Falha: {nome}", state="error")
                        st.error(f"{nome}: {erro}")
                    elif dados and docx_path:
                        status.update(label=f"Sucesso: {nome}", state="complete")
                        st.success(f"Relatório pronto para {nome}")
                        with open(docx_path, "rb") as file:
                            st.download_button(
                                f"Baixar {nome}",
                                file,
                                file_name=f"{nome}.docx",
                                key=f"btn_{index}",
                            )
                        sucessos += 1
                    else:
                        status.update(label=f"Sem dados: {nome}", state="error")
                        st.warning(f"{nome}: nenhuma informação retornada.")

            progress_bar.progress(1.0, text="Finalizado!")
            if sucessos == len(nomes):
                st.success(f"Concluído! {sucessos} de {len(nomes)} currículos processados.")
            else:
                st.warning(f"Finalizado com {sucessos} de {len(nomes)} currículos processados.")
