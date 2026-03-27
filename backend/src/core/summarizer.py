import os

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


async def resumir_curriculo(
    texto: str,
    api_key: str | None = None,
    modelo: str = "gpt-4o-mini",
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
                "content": (
                    "Analise e resuma o currículo Lattes abaixo:\n\n"
                    + texto[:_MAX_TEXTO_CHARS]
                ),
            },
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""
