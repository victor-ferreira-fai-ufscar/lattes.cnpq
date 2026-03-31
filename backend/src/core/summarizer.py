import os
from asyncio import to_thread
from importlib import import_module
from typing import Any
from urllib.request import Request, urlopen

from openai import AsyncOpenAI

_PROMPT_SISTEMA = """\
Você é um assistente especializado em análise de currículos acadêmicos brasileiros (Lattes/CNPq).
Ao receber o texto bruto de um currículo, produza um resumo estruturado em português.

IMPORTANTE: considere que a fonte principal é o texto extraído de um PDF do currículo.
- Priorize sempre informações explícitas no texto extraído do PDF.
- Se houver ambiguidade, prefira a interpretação mais conservadora.
- Não invente dados. Quando faltar informação, escreva "Não informado no PDF".

Estruture a resposta nesta ordem:
1. **Resumo Executivo**: 3-5 linhas com visão geral do perfil (esta seção deve vir primeiro)
2. **Identificação**: nome completo, maior titulação, instituição atual
3. **Formação Acadêmica**: graduação, mestrado, doutorado e pós-doutorado (ano e instituição)
4. **Atuação Profissional**: cargos e vínculos institucionais atuais
5. **Produção Científica**: principais publicações, patentes ou produções relevantes (inclua quantidade aproximada e área)
6. **Projetos e Orientações**: projetos em andamento e orientações acadêmicas

Estilo de Markdown (obrigatório):
- Use títulos de seção com "##".
- Em "Resumo Executivo", coloque o parágrafo em bloco de citação usando ">".
- Use listas com marcadores para itens principais.
- Use uma tabela curta (quando possível) em "Formação Acadêmica" com colunas: Nível | Instituição | Ano.
- Destaque dados-chave com negrito, sem exagero.

Regras obrigatórias de saída:
- Responda APENAS com UM bloco de código Markdown cercado por ```markdown e ```.
- Não inclua texto fora do bloco de código.
- Preserve quebras de linha e espaçamento para facilitar leitura e renderização.\
"""

# Limite de caracteres enviados ao modelo (~30 k tokens de contexto já é amplo para CVs)
_MAX_TEXTO_CHARS = 80_000


def _build_user_prompt(texto: str) -> str:
    return (
        "Analise e resuma o currículo Lattes abaixo (texto extraído do PDF):\n\n"
        + texto[:_MAX_TEXTO_CHARS]
    )


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
        genai: Any = import_module("google.generativeai")

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

    raise ValueError("Provedor de IA inválido. Use: openai, gemini ou ollama.")


async def _listar_modelos_openai(api_key: str | None) -> list[str]:
    chave = api_key or os.environ.get("OPENAI_API_KEY")
    if not chave:
        raise ValueError(
            "Chave da API OpenAI não configurada. "
            "Defina OPENAI_API_KEY no backend ou informe via parâmetro api_key."
        )

    client = AsyncOpenAI(api_key=chave)
    response = await client.models.list()
    modelos = sorted({item.id for item in response.data if getattr(item, "id", None)})
    return modelos


async def _listar_modelos_gemini(api_key: str | None) -> list[str]:
    chave = api_key or os.environ.get("GEMINI_API_KEY")
    if not chave:
        raise ValueError(
            "Chave da API Gemini não configurada. "
            "Defina GEMINI_API_KEY no backend ou informe via parâmetro api_key."
        )

    def _call_gemini() -> list[str]:
        genai: Any = import_module("google.generativeai")

        genai.configure(api_key=chave)
        modelos: list[str] = []
        for model in genai.list_models():
            supported = getattr(model, "supported_generation_methods", []) or []
            if "generateContent" not in supported:
                continue
            name = getattr(model, "name", "")
            if not name:
                continue
            modelos.append(name.replace("models/", "", 1))
        return sorted(set(modelos))

    try:
        return await to_thread(_call_gemini)
    except ImportError as exc:
        raise ValueError(
            "Dependência do Gemini não encontrada. "
            "Adicione 'google-generativeai' nas dependências do backend."
        ) from exc


async def _listar_modelos_ollama(api_key: str | None) -> list[str]:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    def _call_ollama() -> dict:
        request = Request(f"{base_url}/api/tags")
        if api_key:
            request.add_header("Authorization", f"Bearer {api_key}")
        with urlopen(request, timeout=20) as response:
            payload = response.read().decode("utf-8")
        import json

        return json.loads(payload)

    data = await to_thread(_call_ollama)
    models_raw = data.get("models", []) if isinstance(data, dict) else []
    modelos = sorted(
        {
            item.get("name", "")
            for item in models_raw
            if isinstance(item, dict) and item.get("name")
        }
    )
    return modelos


async def listar_modelos(
    *,
    provedor: str = "openai",
    api_key: str | None = None,
) -> list[str]:
    provedor_normalizado = (provedor or "openai").strip().lower()

    if provedor_normalizado == "openai":
        return await _listar_modelos_openai(api_key)

    if provedor_normalizado == "gemini":
        return await _listar_modelos_gemini(api_key)

    if provedor_normalizado == "ollama":
        return await _listar_modelos_ollama(api_key)

    raise ValueError("Provedor de IA inválido. Use: openai, gemini ou ollama.")
