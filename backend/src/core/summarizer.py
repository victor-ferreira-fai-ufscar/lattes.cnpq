import os
from asyncio import to_thread
from importlib import import_module
from typing import Any
from urllib.request import Request, urlopen

from openai import AsyncOpenAI

_PROMPT_SISTEMA = """\
Você é um assistente especializado em análise de currículos acadêmicos brasileiros (Lattes/CNPq).
Ao receber o texto bruto de um currículo, produza um resumo estruturado em português.

IMPORTANTE: considere que a fonte principal é o texto extraído de um PDF do currículo, mas pode haver um texto auxiliar extraído do HTML da página.
- Para cada informação, procure primeiro no PDF.
- Se a informação não aparecer no PDF, tente encontrá-la no HTML.
- Se houver conflito entre PDF e HTML, prefira o PDF e adote a interpretação mais conservadora.
- Não invente dados.
- Quando uma informação não aparecer nem no PDF nem no HTML, escreva de forma explícita que ela não foi encontrada em nenhuma das duas fontes. Exemplo: "Não encontrado no PDF nem no HTML" ou "Não foram encontradas informações sobre pós-doutorado no PDF nem no HTML".
- Evite frases que indiquem ausência apenas no PDF quando o HTML também foi fornecido.

Ao interpretar formação, titulação e distinções acadêmicas, aplique a seguinte hierarquia:
- Educação básica/técnica: ensino médio, ensino médio-técnico e cursos profissionalizantes.
- Graduação: tecnólogo, bacharelado e licenciatura.
- Pós-graduação lato sensu: especialização e MBA.
- Pós-graduação stricto sensu: mestrado e doutorado.
- Distinções e etapas posteriores: pós-doutorado, livre-docência e professor emérito.

Regras obrigatórias de classificação acadêmica:
- Trate doutorado como o maior grau acadêmico formal.
- Não trate pós-doutorado como um novo título acima de doutorado; classifique-o como estágio ou experiência de pesquisa posterior ao doutorado.
- Não trate livre-docência nem professor emérito como graus formais equivalentes a mestrado ou doutorado; classifique-os como distinções de carreira.
- Quando houver múltiplas formações, identifique explicitamente a maior titulação formal concluída.
- Quando houver especialização, MBA, cursos técnicos ou cursos profissionalizantes, registre-os como formação complementar.
- Na seção de formação, diferencie sempre que possível: grau formal, formação complementar e distinção de carreira.

Estruture a resposta nesta ordem:
1. **Resumo Executivo**: 3-5 linhas com visão geral do perfil (esta seção deve vir primeiro)
2. **Identificação**: nome completo, maior titulação, instituição atual
3. **Formação Acadêmica**: graduação, mestrado, doutorado, pós-doutorado, especializações relevantes e distinções acadêmicas/carreira (ano e instituição, quando disponível)
4. **Atuação Profissional**: cargos e vínculos institucionais atuais
5. **Produção Científica**: principais publicações, patentes ou produções relevantes (inclua quantidade aproximada e área)
6. **Projetos e Orientações**: projetos em andamento e orientações acadêmicas

Estilo de Markdown (obrigatório):
- Use títulos de seção com "##".
- Em "Resumo Executivo", coloque o parágrafo em bloco de citação usando ">".
- Use listas com marcadores para itens principais.
- Use uma tabela curta (quando possível) em "Formação Acadêmica" com colunas: Nível | Instituição | Ano.
- Em "Identificação", informe explicitamente a maior titulação formal.
- Em "Formação Acadêmica", deixe claro quando um item for formação complementar ou distinção de carreira.
- Destaque dados-chave com negrito, sem exagero.

Regras obrigatórias de saída:
- Responda APENAS com UM bloco de código Markdown cercado por ```markdown e ```.
- Não inclua texto fora do bloco de código.
- Preserve quebras de linha e espaçamento para facilitar leitura e renderização.\
"""

# Limite de caracteres enviados ao modelo (~30 k tokens de contexto já é amplo para CVs)
_MAX_TEXTO_CHARS = 80_000


def _truncate_text(texto: str, *, max_chars: int) -> str:
    return texto[:max_chars].strip()


def _build_user_prompt(
    texto: str,
    *,
    texto_pdf: str | None = None,
    texto_html: str | None = None,
) -> str:
    pdf_limpo = (texto_pdf or "").strip()
    html_limpo = (texto_html or "").strip()

    if not pdf_limpo and not html_limpo:
        return "Analise e resuma o currículo Lattes abaixo.\n\n" + _truncate_text(
            texto, max_chars=_MAX_TEXTO_CHARS
        )

    prompt_parts = [
        "Analise e resuma o currículo Lattes abaixo.",
        "Use o PDF como fonte principal para cada campo e consulte o HTML apenas quando a informação não estiver presente no PDF.",
    ]

    if pdf_limpo:
        prompt_parts.append(
            "\n[FONTE PRINCIPAL: PDF]\n"
            + _truncate_text(pdf_limpo, max_chars=int(_MAX_TEXTO_CHARS * 0.7))
        )
    else:
        prompt_parts.append(
            "\n[FONTE PRINCIPAL: PDF]\nPDF não disponível ou sem texto utilizável."
        )

    if html_limpo:
        prompt_parts.append(
            "\n[FONTE AUXILIAR: HTML]\n"
            + _truncate_text(html_limpo, max_chars=int(_MAX_TEXTO_CHARS * 0.3))
        )
    else:
        prompt_parts.append(
            "\n[FONTE AUXILIAR: HTML]\nHTML não disponível ou sem texto utilizável."
        )

    return "\n\n".join(prompt_parts)


async def _resumir_openai(
    texto: str,
    *,
    texto_pdf: str | None,
    texto_html: str | None,
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
                "content": _build_user_prompt(
                    texto,
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                ),
            },
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


async def _resumir_gemini(
    texto: str,
    *,
    texto_pdf: str | None,
    texto_html: str | None,
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
            [
                _PROMPT_SISTEMA,
                _build_user_prompt(
                    texto,
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                ),
            ],
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
    texto_pdf: str | None,
    texto_html: str | None,
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
                "content": _build_user_prompt(
                    texto,
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                ),
            },
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


async def resumir_curriculo(
    texto: str,
    *,
    texto_pdf: str | None = None,
    texto_html: str | None = None,
    api_key: str | None = None,
    modelo: str = "gpt-4o-mini",
    provedor: str = "openai",
) -> str:
    provedor_normalizado = (provedor or "openai").strip().lower()

    if provedor_normalizado == "openai":
        return await _resumir_openai(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
        )

    if provedor_normalizado == "gemini":
        return await _resumir_gemini(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
        )

    if provedor_normalizado == "ollama":
        return await _resumir_ollama(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
        )

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
