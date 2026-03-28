import os
from asyncio import to_thread

from openai import AsyncOpenAI

_PROMPT_SISTEMA = """\
Você é um assistente especializado em análise de currículos acadêmicos brasileiros (Lattes/CNPq).
Ao receber o texto bruto de um currículo, produza um resumo estruturado em português com as seguintes seções:

1. **Identificação**: nome completo, maior titulação, instituição atual
2. **Formação Acadêmica**: graduação, mestrado, doutorado e pós-doutorado (com ano e instituição)
3. **Atuação Profissional**: cargos e vínculos institucionais atuais
4. **Produção Científica**: principais publicações, patentes ou produções relevantes (destaque quantidade e área)
5. **Projetos e Orientações**: projetos em andamento e orientações acadêmicas
6. **Resumo Executivo**: parágrafo de 3–5 linhas sintetizando o perfil do pesquisador

Seja conciso, objetivo e use formatação Markdown clara.\
"""

# Limite de caracteres enviados ao modelo (~30 k tokens de contexto já é amplo para CVs)
_MAX_TEXTO_CHARS = 80_000


def _build_user_prompt(texto: str) -> str:
    return "Analise e resuma o currículo Lattes abaixo:\n\n" + texto[:_MAX_TEXTO_CHARS]


async def _resumir_openai(
    texto: str,
    *,
    api_key: str | None,
    modelo: str,
) -> str:
    chave = api_key or os.environ.get("OPENAI_API_KEY")
    if not chave:
        raise ValueError(
            "Chave da API OpenAI não configurada. "
            "Defina OPENAI_API_KEY no backend ou informe via parâmetro api_key."
        )

    client = AsyncOpenAI(api_key=chave)
    response = await client.chat.completions.create(
        model=modelo,
        messages=[
            {"role": "system", "content": _PROMPT_SISTEMA},
            {
                "role": "user",
                "content": _build_user_prompt(texto),
            },
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


async def _resumir_gemini(
    texto: str,
    *,
    api_key: str | None,
    modelo: str,
) -> str:
    chave = api_key or os.environ.get("GEMINI_API_KEY")
    if not chave:
        raise ValueError(
            "Chave da API Gemini não configurada. "
            "Defina GEMINI_API_KEY no backend ou informe via parâmetro api_key."
        )

    def _call_gemini() -> str:
        import google.generativeai as genai

        genai.configure(api_key=chave)
        model = genai.GenerativeModel(model_name=modelo)
        response = model.generate_content(
            [_PROMPT_SISTEMA, _build_user_prompt(texto)],
            generation_config={"temperature": 0.3},
        )
        return getattr(response, "text", "") or ""

    try:
        return await to_thread(_call_gemini)
    except ImportError as exc:
        raise ValueError(
            "Dependência do Gemini não encontrada. "
            "Adicione 'google-generativeai' nas dependências do backend."
        ) from exc


async def _resumir_ollama(
    texto: str,
    *,
    api_key: str | None,
    modelo: str,
) -> str:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    # A API compatível com OpenAI do Ollama normalmente ignora api_key.
    client = AsyncOpenAI(
        api_key=api_key or os.environ.get("OLLAMA_API_KEY", "ollama"),
        base_url=f"{base_url}/v1",
    )

    response = await client.chat.completions.create(
        model=modelo,
        messages=[
            {"role": "system", "content": _PROMPT_SISTEMA},
            {
                "role": "user",
                "content": _build_user_prompt(texto),
            },
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


async def resumir_curriculo(
    texto: str,
    api_key: str | None = None,
    modelo: str = "gpt-4o-mini",
    provedor: str = "openai",
) -> str:
    provedor_normalizado = (provedor or "openai").strip().lower()

    if provedor_normalizado == "openai":
        return await _resumir_openai(texto, api_key=api_key, modelo=modelo)

    if provedor_normalizado == "gemini":
        return await _resumir_gemini(texto, api_key=api_key, modelo=modelo)

    if provedor_normalizado == "ollama":
        return await _resumir_ollama(texto, api_key=api_key, modelo=modelo)

    raise ValueError(
        "Provedor de IA inválido. Use: openai, gemini ou ollama."
    )
