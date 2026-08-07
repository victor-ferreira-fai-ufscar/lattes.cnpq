import asyncio
from contextlib import suppress
import os
from asyncio import to_thread
from importlib import import_module
from typing import Any, Callable, Sequence
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from openai import AsyncOpenAI

from .perfil_externo import BibliometriaExterna, NoticiaExterna
from .sections import label_da_secao

LogFn = Callable[[str], None]

# Endpoints padrão tentados quando o Ollama roda fora de container nesta máquina.
# host.docker.internal cobre o caso em container; localhost/127.0.0.1 cobrem o
# caso do Ollama rodando direto no host (não containerizado).
_OLLAMA_DEFAULT_CANDIDATES = (
    "http://host.docker.internal:11434",
    "http://localhost:11434",
    "http://127.0.0.1:11434",
)

# Lembra o último endpoint que respondeu para evitar re-sondar a cada chamada.
_ollama_base_url_cache: str | None = None


def _ollama_base_url_candidates() -> list[str]:
    """Monta a lista ordenada de endpoints do Ollama a tentar.

    Prioridade: OLLAMA_BASE_URLS (lista separada por vírgula) > OLLAMA_BASE_URL
    (URL única) > endpoints padrão (host.docker.internal, localhost, 127.0.0.1).
    """
    candidates: list[str] = []

    for item in os.environ.get("OLLAMA_BASE_URLS", "").split(","):
        url = item.strip().rstrip("/")
        if url:
            candidates.append(url)

    single = os.environ.get("OLLAMA_BASE_URL", "").strip().rstrip("/")
    if single:
        candidates.append(single)

    candidates.extend(_OLLAMA_DEFAULT_CANDIDATES)

    seen: set[str] = set()
    unique: list[str] = []
    for url in candidates:
        if url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def _ollama_endpoint_acessivel(
    base_url: str, api_key: str | None, timeout: float = 2.5
) -> bool:
    """Verifica se há um Ollama respondendo em base_url (via /api/version)."""
    request = Request(f"{base_url}/api/version")
    if api_key:
        request.add_header("Authorization", f"Bearer {api_key}")
    try:
        with urlopen(request, timeout=timeout):
            return True
    except HTTPError:
        # O servidor respondeu (ainda que com erro HTTP): está acessível.
        return True
    except Exception:
        return False


async def _resolver_base_url_ollama(
    api_key: str | None, log: LogFn | None = None
) -> str:
    """Resolve o primeiro endpoint do Ollama acessível dentre os candidatos."""
    global _ollama_base_url_cache

    candidates = _ollama_base_url_candidates()

    # Tenta primeiro o último endpoint que funcionou.
    if _ollama_base_url_cache and _ollama_base_url_cache in candidates:
        candidates = [_ollama_base_url_cache] + [
            url for url in candidates if url != _ollama_base_url_cache
        ]

    for base_url in candidates:
        if await to_thread(_ollama_endpoint_acessivel, base_url, api_key):
            if log and base_url != _ollama_base_url_cache:
                log(f"Ollama acessível em '{base_url}'.")
            _ollama_base_url_cache = base_url
            return base_url

    # Nenhum respondeu: usa o primeiro candidato para que o erro real apareça depois.
    fallback = candidates[0]
    if log:
        log(
            "Nenhum endpoint do Ollama respondeu "
            f"(tentados: {', '.join(candidates)}). Usando '{fallback}'."
        )
    return fallback

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
- Registre o **curso** de cada formação, não apenas o nível. O Lattes escreve "Doutorado em Odontologia" ou "Graduação em Ciência da Computação": o curso é a parte após "em" e é o que identifica a área de origem do docente. Quando o curso não aparecer na fonte, escreva "não informado" em vez de omitir a coluna ou repetir o nível.

Estruture a resposta nesta ordem:
1. **Resumo Executivo**: 3-5 linhas com visão geral do perfil (esta seção deve vir primeiro)
2. **Identificação**: nome completo, maior titulação, instituição atual
3. **Formação Acadêmica**: graduação, mestrado, doutorado, pós-doutorado, especializações relevantes e distinções acadêmicas/carreira (curso, ano e instituição, quando disponível)
4. **Atuação Profissional**: cargos e vínculos institucionais atuais
5. **Produção Científica**: principais publicações, patentes ou produções relevantes (inclua quantidade aproximada e área)
6. **Projetos e Orientações**: projetos em andamento e orientações acadêmicas

Estilo de Markdown (obrigatório):
- Use títulos de seção com "##".
- Em "Resumo Executivo", coloque o parágrafo em bloco de citação usando ">".
- Use listas com marcadores para itens principais.
- Use uma tabela curta (quando possível) em "Formação Acadêmica" com colunas: Nível | Curso | Instituição | Ano.
- Em "Identificação", informe explicitamente a maior titulação formal.
- Em "Formação Acadêmica", deixe claro quando um item for formação complementar ou distinção de carreira.
- Destaque dados-chave com negrito, sem exagero.

Regras obrigatórias de saída:
- Responda APENAS com UM bloco de código Markdown cercado por ```markdown e ```.
- Não inclua texto fora do bloco de código.
- Preserve quebras de linha e espaçamento para facilitar leitura e renderização.\
"""

# Anexado ao prompt de sistema só quando há notícias a incluir. Fica fora de
# _PROMPT_SISTEMA de propósito: a maioria dos docentes não tem notícia publicável,
# e uma seção obrigatória sem material é convite para o modelo preencher com
# invenção — exatamente o que as regras de veracidade tentam evitar.
_INSTRUCAO_NOTICIAS = """\

Você receberá também um bloco [FONTE EXTERNA: NOTÍCIAS], que vem do Google News e
NÃO do currículo. Regras próprias para ele:
- Acrescente ao final uma sétima seção "## Notícias e Menções na Imprensa",
  listando as notícias na ordem recebida (já vêm da mais recente para a mais
  antiga), cada item com título, veículo e data.
- Use exclusivamente o que está no bloco. Não complemente com conhecimento
  próprio sobre a pessoa nem sobre os fatos noticiados.
- Não use notícia como fonte das outras seções: titulação, vínculo institucional
  e produção saem do PDF/HTML do currículo. Se uma notícia contradisser o
  currículo, mantenha o currículo e não comente a divergência.\
"""

# Também anexado só quando há material, pela mesma razão do bloco de notícias:
# frase obrigatória sem indicador é convite para o modelo inventar número.
#
# Diferente das notícias, este bloco entra no **Resumo Executivo** — é dado
# quantitativo de fonte nomeada, não manchete, e a atribuição explícita mantém
# visível que ele não saiu do Lattes. O que continua proibido é o mesmo:
# indicador do OpenAlex não vira titulação, vínculo nem contagem de produção.
_INSTRUCAO_BIBLIOMETRIA = """\

Você receberá também um bloco [FONTE EXTERNA: PRODUÇÃO (OpenAlex)], com
indicadores bibliométricos que vêm do OpenAlex e NÃO do currículo. Regras
próprias para ele:
- Acrescente ao Resumo Executivo UMA frase (no máximo) com esses indicadores,
  sempre nomeando a fonte. Formato: "Registra <obras indexadas> obras,
  <citações recebidas> citações e h-index <h-index>, segundo o OpenAlex." Com
  essa frase, o Resumo Executivo pode chegar a seis linhas.
- Substitua cada <...> pelo valor correspondente do bloco. Reproduza apenas os
  números do bloco: não calcule, não estime e não complete indicador ausente —
  se o bloco não traz h-index, não mencione h-index.
- Não use esses indicadores como fonte de titulação, de vínculo institucional
  nem das quantidades da seção "Produção Científica" — essas saem do PDF/HTML do
  currículo. Se citá-los em outra seção, repita a atribuição ao OpenAlex.
- Divergência entre a contagem do OpenAlex e a do currículo não é erro: são
  bases diferentes. Mantenha as duas, cada uma com sua fonte, e não comente a
  diferença.\
"""

# Instrução de saída específica de cada seção do resumo. A key bate com as do
# seletor (ver core.sections.SECOES_RESUMO).
_INSTRUCOES_SECAO: dict[str, str] = {
    "resumo": (
        "Resuma o 'Resumo informado pelo autor' do currículo: a apresentação que "
        "o próprio docente faz de si, seus interesses e foco de atuação. Sintetize "
        "em poucas linhas, sem copiar literalmente."
    ),
    "formacao": (
        "Resuma a Formação Acadêmica/Titulação: graduação, mestrado, doutorado, "
        "pós-doutorado, especializações e distinções (com curso, ano e instituição "
        "quando disponíveis).\n"
        "Registre o curso de cada formação, não apenas o nível: o Lattes escreve "
        "'Doutorado em Odontologia' ou 'Graduação em Ciência da Computação', e o "
        "curso é a parte após 'em' — é o que identifica a área de origem do "
        "docente. Quando o curso não aparecer na fonte, escreva 'não informado' "
        "em vez de omitir a coluna ou repetir o nível.\n"
        "Aplique a hierarquia acadêmica: doutorado é o maior grau formal; "
        "pós-doutorado é experiência posterior ao doutorado, não um título acima "
        "dele; livre-docência e professor emérito são distinções de carreira, não "
        "graus formais. Indique explicitamente a maior titulação formal concluída "
        "e diferencie formação complementar de distinção de carreira.\n"
        "Quando possível, use uma tabela curta com colunas: "
        "Nível | Curso | Instituição | Ano."
    ),
    "atuacao": (
        "Resuma a Atuação Profissional: vínculos institucionais, cargos/funções, "
        "regime de trabalho e períodos. Destaque o vínculo atual."
    ),
    "producao": (
        "Resuma a Produção Bibliográfica: principais publicações (artigos, livros, "
        "capítulos, trabalhos em eventos), com quantidades aproximadas por tipo e os "
        "temas predominantes."
    ),
    "orientacoes": (
        "Resuma as Orientações: orientações concluídas e em andamento, por nível "
        "(iniciação científica, mestrado, doutorado), com quantidades aproximadas."
    ),
    "projetos": (
        "Resuma os Projetos de Pesquisa (e linhas de pesquisa, se houver): projetos "
        "em andamento e concluídos, temas e financiadores quando informados."
    ),
}

# Prompt de sistema usado quando o usuário pede apenas UMA seção do currículo.
_PROMPT_SISTEMA_SECAO = """\
Você é um assistente especializado em análise de currículos acadêmicos brasileiros (Lattes/CNPq).
Sua tarefa é produzir, em português, o resumo de UMA seção específica do currículo: "{secao_label}".

{instrucao}

Fontes e veracidade:
- A fonte principal é o texto extraído do PDF; pode haver um texto auxiliar extraído do HTML.
- Para cada informação, procure primeiro no PDF; se não estiver lá, consulte o HTML.
- Não invente dados. Se a seção não tiver informações, escreva explicitamente que não foram encontradas no PDF nem no HTML.
- Você receberá preferencialmente apenas o trecho desta seção. Se receber o currículo inteiro, considere SOMENTE o que pertence a "{secao_label}" e ignore as demais seções.

Estilo de Markdown (obrigatório):
- Inicie com um título de seção usando "## {secao_label}".
- Use listas com marcadores para os itens principais.
- Destaque dados-chave com negrito, sem exagero.

Regras obrigatórias de saída:
- Responda APENAS com UM bloco de código Markdown cercado por ```markdown e ```.
- Não inclua texto fora do bloco de código.
- Preserve quebras de linha e espaçamento para facilitar leitura e renderização.\
"""


def _build_system_prompt(
    secao: str | None,
    *,
    com_noticias: bool = False,
    com_bibliometria: bool = False,
) -> str:
    """Prompt de sistema: completo (None) ou focado em uma seção específica.

    O perfil externo (notícias e bibliometria) só entra no resumo do currículo
    inteiro. Num resumo de seção o usuário pediu um recorte do Lattes ("Formação
    acadêmica/titulação", por exemplo), e enxertar fonte externa ali seria
    responder outra pergunta.
    """
    if not secao:
        # Mesma ordem dos blocos no prompt do usuário: produção, depois imprensa.
        # Cada instrução já começa com "\n", então o join separa as duas por uma
        # linha em branco — sem isso a segunda cola no último item da primeira e
        # passa a ler como continuação daquele bullet.
        partes = [_PROMPT_SISTEMA]
        if com_bibliometria:
            partes.append(_INSTRUCAO_BIBLIOMETRIA)
        if com_noticias:
            partes.append(_INSTRUCAO_NOTICIAS)
        return "\n".join(partes)

    instrucao = _INSTRUCOES_SECAO.get(secao)
    secao_label = label_da_secao(secao)
    if not instrucao or not secao_label:
        return _PROMPT_SISTEMA

    return _PROMPT_SISTEMA_SECAO.format(secao_label=secao_label, instrucao=instrucao)


# Limite de caracteres enviados ao modelo (~30 k tokens de contexto já é amplo para CVs)
_MAX_TEXTO_CHARS = 80_000


def _truncate_text(texto: str, *, max_chars: int) -> str:
    return texto[:max_chars].strip()


def _formatar_noticia_prompt(noticia: NoticiaExterna) -> str:
    detalhes = ", ".join(
        parte
        for parte in (
            noticia.veiculo,
            noticia.data.strftime("%d/%m/%Y") if noticia.data else None,
        )
        if parte
    )
    sufixo = f" ({detalhes})" if detalhes else ""
    return f"- {noticia.titulo}{sufixo}"


def _bloco_noticias(noticias: Sequence[NoticiaExterna]) -> str:
    return "\n[FONTE EXTERNA: NOTÍCIAS]\n" + "\n".join(
        _formatar_noticia_prompt(noticia) for noticia in noticias
    )


def _bloco_bibliometria(bibliometria: BibliometriaExterna) -> str:
    linhas = []
    if bibliometria.total_obras:
        linhas.append(f"- Obras indexadas: {bibliometria.total_obras}")
    if bibliometria.total_citacoes:
        linhas.append(f"- Citações recebidas: {bibliometria.total_citacoes}")
    if bibliometria.h_index:
        linhas.append(f"- h-index: {bibliometria.h_index}")
    return "\n[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]\n" + "\n".join(linhas)


def _blocos_externos(
    bibliometria: BibliometriaExterna | None,
    noticias: Sequence[NoticiaExterna],
) -> list[str]:
    """Blocos de fonte externa, na ordem em que o prompt de sistema os descreve.

    Nenhum tem contrapartida de "não disponível": ausência de perfil externo é o
    caso comum (a maioria dos docentes não atinge confiança alta), e anunciá-la
    só gastaria contexto.
    """
    blocos: list[str] = []
    if bibliometria is not None:
        blocos.append(_bloco_bibliometria(bibliometria))
    if noticias:
        blocos.append(_bloco_noticias(noticias))
    return blocos


def _build_user_prompt(
    texto: str,
    *,
    texto_pdf: str | None = None,
    texto_html: str | None = None,
    secao_label: str | None = None,
    noticias: Sequence[NoticiaExterna] | None = None,
    bibliometria: BibliometriaExterna | None = None,
) -> str:
    pdf_limpo = (texto_pdf or "").strip()
    html_limpo = (texto_html or "").strip()
    noticias = tuple(noticias or ())
    blocos_externos = _blocos_externos(bibliometria, noticias)

    if secao_label:
        intro = f"Analise e resuma a seção '{secao_label}' do currículo Lattes abaixo."
    else:
        intro = "Analise e resuma o currículo Lattes abaixo."

    if not pdf_limpo and not html_limpo:
        corpo = intro + "\n\n" + _truncate_text(texto, max_chars=_MAX_TEXTO_CHARS)
        return "\n\n".join([corpo, *blocos_externos])

    prompt_parts = [
        intro,
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

    # As fontes externas vêm depois das do currículo, que é o dado principal.
    prompt_parts.extend(blocos_externos)

    return "\n\n".join(prompt_parts)


async def _resumir_openai(
    texto: str,
    *,
    texto_pdf: str | None,
    texto_html: str | None,
    api_key: str | None,
    modelo: str,
    secao: str | None = None,
    noticias: Sequence[NoticiaExterna] | None = None,
    bibliometria: BibliometriaExterna | None = None,
    log: LogFn | None = None,
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
            {
                "role": "system",
                "content": _build_system_prompt(
                    secao,
                    com_noticias=bool(noticias),
                    com_bibliometria=bibliometria is not None,
                ),
            },
            {
                "role": "user",
                "content": _build_user_prompt(
                    texto,
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                    secao_label=label_da_secao(secao),
                    noticias=noticias,
                    bibliometria=bibliometria,
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
    secao: str | None = None,
    noticias: Sequence[NoticiaExterna] | None = None,
    bibliometria: BibliometriaExterna | None = None,
    log: LogFn | None = None,
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
                _build_system_prompt(
                    secao,
                    com_noticias=bool(noticias),
                    com_bibliometria=bibliometria is not None,
                ),
                _build_user_prompt(
                    texto,
                    texto_pdf=texto_pdf,
                    texto_html=texto_html,
                    secao_label=label_da_secao(secao),
                    noticias=noticias,
                    bibliometria=bibliometria,
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
    secao: str | None = None,
    noticias: Sequence[NoticiaExterna] | None = None,
    bibliometria: BibliometriaExterna | None = None,
    log: LogFn | None = None,
) -> str:
    base_url = await _resolver_base_url_ollama(api_key, log=log)

    async def emit_ollama_progress() -> None:
        elapsed = 0
        while True:
            await asyncio.sleep(10)
            elapsed += 10

            if not log:
                continue

            status_message = "aguardando resposta do Ollama"
            try:
                ps_payload = await to_thread(
                    _consultar_status_ollama, base_url, api_key
                )
                status_message = _descrever_status_ollama(ps_payload, modelo)
            except Exception:
                status_message = "aguardando resposta do Ollama"

            log(
                f"Ollama ainda está processando o resumo ({elapsed}s): {status_message}."
            )

    if log:
        log(f"Conectando ao Ollama em '{base_url}'.")
        log(f"Enviando solicitação para o modelo '{modelo}'.")
        log(
            "O Ollama pode demorar no primeiro uso enquanto carrega o modelo na memória."
        )
    # A API compatível com OpenAI do Ollama normalmente ignora api_key.
    client = AsyncOpenAI(
        api_key=api_key or os.environ.get("OLLAMA_API_KEY", "ollama"),
        base_url=f"{base_url}/v1",
    )

    progress_task = asyncio.create_task(emit_ollama_progress()) if log else None
    try:
        response = await client.chat.completions.create(
            model=modelo,
            messages=[
                {
                    "role": "system",
                    "content": _build_system_prompt(
                        secao,
                        com_noticias=bool(noticias),
                        com_bibliometria=bibliometria is not None,
                    ),
                },
                {
                    "role": "user",
                    "content": _build_user_prompt(
                        texto,
                        texto_pdf=texto_pdf,
                        texto_html=texto_html,
                        secao_label=label_da_secao(secao),
                        noticias=noticias,
                        bibliometria=bibliometria,
                    ),
                },
            ],
            temperature=0.3,
        )
    finally:
        if progress_task:
            progress_task.cancel()
            with suppress(asyncio.CancelledError):
                await progress_task

    if log:
        log(f"Resposta recebida do modelo '{modelo}' via Ollama.")
    return response.choices[0].message.content or ""


def _consultar_status_ollama(base_url: str, api_key: str | None) -> dict[str, Any]:
    request = Request(f"{base_url}/api/ps")
    if api_key:
        request.add_header("Authorization", f"Bearer {api_key}")
    with urlopen(request, timeout=10) as response:
        payload = response.read().decode("utf-8")

    import json

    parsed = json.loads(payload)
    return parsed if isinstance(parsed, dict) else {}


def _descrever_status_ollama(payload: dict[str, Any], modelo: str) -> str:
    models_raw = payload.get("models", []) if isinstance(payload, dict) else []
    if not isinstance(models_raw, list) or not models_raw:
        return "serviço ativo, mas sem modelo carregado no momento"

    for item in models_raw:
        if not isinstance(item, dict):
            continue
        if item.get("name") != modelo and item.get("model") != modelo:
            continue

        context_length = item.get("context_length")
        expires_at = item.get("expires_at")
        details = item.get("details") if isinstance(item.get("details"), dict) else {}
        parameter_size = details.get("parameter_size")
        quantization_level = details.get("quantization_level")
        parts = ["modelo carregado na memória"]
        if parameter_size:
            parts.append(f"porte {parameter_size}")
        if quantization_level:
            parts.append(f"quantização {quantization_level}")
        if context_length:
            parts.append(f"contexto {context_length}")
        if expires_at:
            parts.append("runner ativo")
        return ", ".join(parts)

    return "serviço ativo, carregando ou alternando o modelo solicitado"


async def resumir_curriculo(
    texto: str,
    *,
    texto_pdf: str | None = None,
    texto_html: str | None = None,
    api_key: str | None = None,
    modelo: str = "gemma4:12b",
    provedor: str = "ollama",
    secao: str | None = None,
    noticias: Sequence[NoticiaExterna] | None = None,
    bibliometria: BibliometriaExterna | None = None,
    log: LogFn | None = None,
) -> str:
    provedor_normalizado = (provedor or "ollama").strip().lower()

    if provedor_normalizado == "openai":
        return await _resumir_openai(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
            secao=secao,
            noticias=noticias,
            bibliometria=bibliometria,
            log=log,
        )

    if provedor_normalizado == "gemini":
        return await _resumir_gemini(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
            secao=secao,
            noticias=noticias,
            bibliometria=bibliometria,
            log=log,
        )

    if provedor_normalizado == "ollama":
        return await _resumir_ollama(
            texto,
            texto_pdf=texto_pdf,
            texto_html=texto_html,
            api_key=api_key,
            modelo=modelo,
            secao=secao,
            noticias=noticias,
            bibliometria=bibliometria,
            log=log,
        )

    raise ValueError("Provedor de IA inválido. Use: openai, gemini ou ollama.")


async def _listar_modelos_openai(
    api_key: str | None, log: LogFn | None = None
) -> list[str]:
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


async def _listar_modelos_gemini(
    api_key: str | None, log: LogFn | None = None
) -> list[str]:
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


async def _listar_modelos_ollama(
    api_key: str | None, log: LogFn | None = None
) -> list[str]:
    base_url = await _resolver_base_url_ollama(api_key, log=log)
    if log:
        log(f"Consultando modelos do Ollama em '{base_url}/api/tags'.")

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
    if log:
        log(f"Ollama respondeu com {len(modelos)} modelo(s) disponível(is).")
    return modelos


async def listar_modelos(
    *,
    provedor: str = "ollama",
    api_key: str | None = None,
    log: LogFn | None = None,
) -> list[str]:
    provedor_normalizado = (provedor or "ollama").strip().lower()

    if provedor_normalizado == "openai":
        return await _listar_modelos_openai(api_key, log=log)

    if provedor_normalizado == "gemini":
        return await _listar_modelos_gemini(api_key, log=log)

    if provedor_normalizado == "ollama":
        return await _listar_modelos_ollama(api_key, log=log)

    raise ValueError("Provedor de IA inválido. Use: openai, gemini ou ollama.")
