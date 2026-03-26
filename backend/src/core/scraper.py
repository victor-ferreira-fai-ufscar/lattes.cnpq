import json
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from browser_use import Agent, BrowserProfile, BrowserSession, ChatOpenAI

_DEFAULT_CHROME = "/opt/google/chrome-unstable/google-chrome-unstable"


async def scrape_lattes(nome: str, modelo: str = "gpt-4o-mini") -> dict:
    """Usa browser-use para buscar e extrair dados do currículo Lattes do docente."""
    llm = ChatOpenAI(model=modelo, api_key=os.environ.get("OPENAI_API_KEY"))

    chrome_path = os.environ.get("CHROME_PATH", _DEFAULT_CHROME)
    profile = BrowserProfile(executable_path=chrome_path, headless=True)
    browser = BrowserSession(browser_profile=profile)

    task = (
        f"Acesse https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar "
        f"e busque pelo docente '{nome}'. "
        "Abra o currículo Lattes do resultado mais relevante e extraia as informações abaixo em JSON:\n"
        "- graduacao: onde e qual curso\n"
        "- mestrado: onde e qual curso/tema\n"
        "- doutorado: onde e qual curso/tema\n"
        "- pos_doutorado: onde e qual instituição (string vazia se não houver)\n"
        "- vinculo_institucional: instituição atual de trabalho\n"
        "- resumo: 2-3 parágrafos sobre a trajetória e pesquisa\n\n"
        "Retorne APENAS o JSON com esses campos, sem formatação markdown."
    )

    agent = Agent(task=task, llm=llm, browser_session=browser)
    result = await agent.run()

    raw = result.final_result() or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"resumo": raw}
