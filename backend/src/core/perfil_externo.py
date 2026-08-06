"""Enriquecimento do docente com fontes externas ao Lattes.

Duas fontes, ambas sem chave de API:

- **OpenAlex** (`api.openalex.org`): produção acadêmica — obras, ano, veículo,
  citações, h-index e afiliação. Substitui o Google Scholar, que não tem API
  pública e bloqueia acesso automatizado (CAPTCHA/banimento por IP) — inviável
  para um lote de ~50 docentes saindo de um IP institucional compartilhado.
- **Google News RSS** (`news.google.com/rss/search`): notícias e menções na
  imprensa. Endpoint não documentado, por isso todo o módulo é desligável via
  `PERFIL_EXTERNO_ENABLED` e cada fonte falha de forma isolada.

O risco central aqui é **homonímia**: "Ana Silva" no OpenAlex ou no Google News
pode ser outra pessoa. Por isso o resultado carrega um nível de confiança
calculado por `_avaliar_confianca`, e só o que atinge `alta` é considerado
publicável (`PerfilExterno.publicavel`) — quem consome decide, mas o padrão é
não mostrar dado de procedência duvidosa em artefato que circula.

Nenhuma exceção escapa de `coletar_perfil_externo`: falhas viram entradas em
`erros` e o perfil volta parcial (ou vazio), nunca derrubando o scraping do
currículo, que é o dado principal.
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from datetime import date
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Literal, Optional
from xml.etree import ElementTree

import httpx

from ..libs.nomes import chave_comparacao, remover_acentos

LogFn = Callable[[str], None]

Confianca = Literal["alta", "media", "baixa"]

_OPENALEX_BASE = "https://api.openalex.org"
_GOOGLE_NEWS_BASE = "https://news.google.com/rss/search"

# Limiares do score de desambiguação (ver _avaliar_confianca).
_SCORE_ALTA = 5
_SCORE_MEDIA = 3

# Termos que, junto com o nome completo, indicam que a notícia é mesmo sobre um
# docente/pesquisador — e não sobre um homônimo qualquer.
_TERMOS_ACADEMICOS = (
    "professor",
    "professora",
    "pesquisador",
    "pesquisadora",
    "pesquisa",
    "universidade",
    "docente",
    "cientista",
    "doutor",
    "doutora",
    "mestrado",
    "doutorado",
)

# Palavras muito comuns em currículo, inúteis como termo distintivo de contexto.
_STOPWORDS_CV = {
    "atuacao",
    "brasil",
    "ciencias",
    "curriculo",
    "desde",
    "estado",
    "federal",
    "graduacao",
    "grande",
    "instituicao",
    "lattes",
    "membro",
    "nacional",
    "outros",
    "paulo",
    "periodicos",
    "pesquisa",
    "professor",
    "programa",
    "projeto",
    "publicados",
    "resumo",
    "sobre",
    "trabalho",
    "universidade",
}


@dataclass(frozen=True)
class ObraExterna:
    titulo: str
    ano: Optional[int] = None
    veiculo: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    citacoes: int = 0


@dataclass(frozen=True)
class NoticiaExterna:
    titulo: str
    url: str
    veiculo: Optional[str] = None
    data: Optional[date] = None


@dataclass(frozen=True)
class BibliometriaExterna:
    """Só os indicadores quantitativos do OpenAlex, sem a lista de obras.

    Recorte próprio porque é o que vai ao prompt do resumo por IA: número que o
    modelo reproduz e atribui a uma fonte nomeada. Os títulos das obras ficam de
    fora de propósito — artigo citado no Resumo Executivo reabriria a porta que
    as regras de veracidade fecham (produção sai do currículo). A afiliação
    também: ela seria tentação de virar vínculo institucional, que é justamente
    o que o prompt proíbe.
    """

    total_obras: int = 0
    total_citacoes: int = 0
    h_index: Optional[int] = None

    @property
    def tem_conteudo(self) -> bool:
        return bool(self.total_obras or self.total_citacoes or self.h_index)


@dataclass(frozen=True)
class PerfilExterno:
    nome_busca: str
    confianca: Confianca = "baixa"
    score: int = 0
    openalex_author_id: Optional[str] = None
    openalex_url: Optional[str] = None
    orcid: Optional[str] = None
    afiliacao: Optional[str] = None
    total_obras: int = 0
    total_citacoes: int = 0
    h_index: Optional[int] = None
    obras: tuple[ObraExterna, ...] = ()
    noticias: tuple[NoticiaExterna, ...] = ()
    criterios: tuple[str, ...] = ()
    fontes: tuple[str, ...] = ()
    erros: tuple[str, ...] = ()

    @property
    def publicavel(self) -> bool:
        """Confiança suficiente para exibir na tela e incluir no export."""
        return self.confianca == "alta" and bool(self.tem_conteudo)

    @property
    def tem_conteudo(self) -> bool:
        return bool(self.obras or self.noticias or self.openalex_author_id)

    @property
    def bibliometria(self) -> Optional[BibliometriaExterna]:
        """Indicadores do OpenAlex, ou None quando não há número algum.

        Perfil casado no OpenAlex mas sem obras indexadas existe (autor novo, ou
        registro só com o ORCID), e nesse caso não há frase a escrever.
        """
        bibliometria = BibliometriaExterna(
            total_obras=self.total_obras,
            total_citacoes=self.total_citacoes,
            h_index=self.h_index,
        )
        return bibliometria if bibliometria.tem_conteudo else None


@dataclass
class _AutorOpenAlex:
    """Recorte do autor do OpenAlex usado no score e no payload."""

    id: str
    display_name: str
    alternativas: list[str] = field(default_factory=list)
    afiliacao: Optional[str] = None
    country_code: Optional[str] = None
    works_count: int = 0
    cited_by_count: int = 0
    h_index: Optional[int] = None
    orcid: Optional[str] = None


# --------------------------------------------------------------------------- #
# Configuração
# --------------------------------------------------------------------------- #


def _is_true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def habilitado() -> bool:
    bruto = os.environ.get("PERFIL_EXTERNO_ENABLED", "true")
    return _is_true(bruto)


def _env_int(nome: str, padrao: int) -> int:
    bruto = os.environ.get(nome, "").strip()
    if not bruto:
        return padrao
    try:
        valor = int(bruto)
    except ValueError:
        return padrao
    return valor if valor > 0 else padrao


def _env_float(nome: str, padrao: float) -> float:
    bruto = os.environ.get(nome, "").strip()
    if not bruto:
        return padrao
    try:
        valor = float(bruto)
    except ValueError:
        return padrao
    return valor if valor > 0 else padrao


def _afiliacoes_alvo() -> list[str]:
    bruto = os.environ.get(
        "PERFIL_EXTERNO_AFILIACOES",
        "UFSCar,Universidade Federal de São Carlos,FAI",
    )
    return [item.strip() for item in bruto.split(",") if item.strip()]


def _mailto() -> str:
    # O parâmetro mailto coloca as chamadas no "polite pool" do OpenAlex, que
    # tem rate limit mais generoso e previsível que o pool anônimo.
    return os.environ.get("OPENALEX_MAILTO", "").strip()


def _user_agent() -> str:
    contato = _mailto()
    base = "lattes-cnpq-fai-ufscar/1.0"
    return f"{base} (mailto:{contato})" if contato else base


# --------------------------------------------------------------------------- #
# OpenAlex
# --------------------------------------------------------------------------- #


def _params_openalex(**extra: Any) -> dict[str, Any]:
    params: dict[str, Any] = dict(extra)
    contato = _mailto()
    if contato:
        params["mailto"] = contato
    return params


def _extrair_afiliacao(payload: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    """Nome e país da última instituição conhecida.

    O OpenAlex migrou de `last_known_institution` (objeto) para
    `last_known_institutions` (lista); aceitamos os dois formatos.
    """
    instituicoes = payload.get("last_known_institutions")
    if isinstance(instituicoes, list) and instituicoes:
        primeira = instituicoes[0] or {}
        if isinstance(primeira, dict):
            return primeira.get("display_name"), primeira.get("country_code")

    legado = payload.get("last_known_institution")
    if isinstance(legado, dict):
        return legado.get("display_name"), legado.get("country_code")

    return None, None


def _parse_autor(payload: dict[str, Any]) -> Optional[_AutorOpenAlex]:
    author_id = payload.get("id")
    display_name = payload.get("display_name")
    if not author_id or not display_name:
        return None

    afiliacao, country_code = _extrair_afiliacao(payload)
    stats = payload.get("summary_stats") or {}
    ids = payload.get("ids") or {}
    alternativas = payload.get("display_name_alternatives") or []

    return _AutorOpenAlex(
        id=str(author_id),
        display_name=str(display_name),
        alternativas=[str(item) for item in alternativas if item],
        afiliacao=afiliacao,
        country_code=country_code,
        works_count=_coerce_int(payload.get("works_count")),
        cited_by_count=_coerce_int(payload.get("cited_by_count")),
        h_index=(
            _coerce_int(stats.get("h_index")) if stats.get("h_index") is not None else None
        ),
        orcid=ids.get("orcid") or payload.get("orcid"),
    )


def _coerce_int(valor: Any) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return 0


async def _buscar_autores_openalex(
    client: httpx.AsyncClient, nome: str
) -> list[_AutorOpenAlex]:
    resposta = await client.get(
        f"{_OPENALEX_BASE}/authors",
        params=_params_openalex(search=nome, **{"per-page": 5}),
    )
    resposta.raise_for_status()
    payload = resposta.json()

    autores: list[_AutorOpenAlex] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        autor = _parse_autor(item)
        if autor is not None:
            autores.append(autor)
    return autores


# Título que na verdade é o nome do campo de metadado, não o conteúdo dele.
# Repositório institucional que expõe Dublin Core por OAI-PMH às vezes entrega a
# etiqueta no lugar do valor, e o OpenAlex indexa como veio: só `title.alternative`
# são ~3 mil obras. O padrão é o de um identificador pontuado — minúsculas, sem
# espaço, com ponto separando os segmentos ("title.alternative", "dc.title").
# Título de verdade tem espaço ou maiúscula; conferido contra 200 títulos reais
# de obras da UFSCar no OpenAlex, nenhum casa.
_RE_TITULO_METADADO = re.compile(r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$")


def _titulo_placeholder(titulo: str) -> bool:
    return bool(_RE_TITULO_METADADO.match(titulo))


def _titulo_obra(payload: dict[str, Any]) -> str:
    """Título utilizável da obra, ou string vazia se não houver.

    `title` e `display_name` costumam ser iguais, mas quando divergem vale o
    primeiro que não seja etiqueta de metadado. Devolver vazio faz a obra ser
    descartada em `_buscar_obras_openalex`: obra sem título não diz nada em tela,
    não serve para casar com o Lattes e ainda ocuparia uma das vagas do limite.
    """
    for bruto in (payload.get("title"), payload.get("display_name")):
        titulo = " ".join(str(bruto or "").split())
        if titulo and not _titulo_placeholder(titulo):
            return titulo
    return ""


def _veiculo_obra(payload: dict[str, Any]) -> Optional[str]:
    location = payload.get("primary_location") or {}
    if not isinstance(location, dict):
        return None
    source = location.get("source") or {}
    if not isinstance(source, dict):
        return None
    nome = source.get("display_name")
    return str(nome) if nome else None


async def _buscar_obras_openalex(
    client: httpx.AsyncClient, author_id: str, limite: int
) -> list[ObraExterna]:
    """As `limite` obras mais citadas do autor, da mais recente para a mais antiga.

    São dois critérios com papéis distintos: a **citação decide quais** obras
    entram (o `sort` do OpenAlex, aplicado sobre a produção inteira antes do
    corte por `per-page`), e a **data decide a ordem** em que elas aparecem na
    tela e nos artefatos exportados. Ordenar por data no pedido traria as mais
    recentes independentemente de relevância, o que é outra lista.
    """
    resposta = await client.get(
        f"{_OPENALEX_BASE}/works",
        params=_params_openalex(
            filter=f"author.id:{author_id}",
            sort="cited_by_count:desc",
            **{"per-page": limite},
        ),
    )
    resposta.raise_for_status()
    payload = resposta.json()

    obras: list[ObraExterna] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        titulo = _titulo_obra(item)
        if not titulo:
            continue
        ano = item.get("publication_year")
        obras.append(
            ObraExterna(
                titulo=titulo,
                ano=int(ano) if isinstance(ano, int) else None,
                veiculo=_veiculo_obra(item),
                doi=item.get("doi"),
                url=item.get("id"),
                citacoes=_coerce_int(item.get("cited_by_count")),
            )
        )

    # O OpenAlex expõe `publication_year`, não a data cheia, então o ano é toda
    # a granularidade disponível: dentro do mesmo ano a mais citada vem antes.
    # Obra sem ano vai para o fim — não há como saber se é recente.
    obras.sort(
        key=lambda obra: (obra.ano is not None, obra.ano or 0, obra.citacoes),
        reverse=True,
    )
    return obras


# --------------------------------------------------------------------------- #
# Google News RSS
# --------------------------------------------------------------------------- #


def _parse_data_rss(valor: Optional[str]) -> Optional[date]:
    if not valor:
        return None
    try:
        return parsedate_to_datetime(valor).date()
    except (TypeError, ValueError):
        return None


def _limpar_titulo_noticia(titulo: str, veiculo: Optional[str]) -> str:
    """O Google News sufixa o título com " - Veículo"; remove a redundância."""
    limpo = " ".join(titulo.split())
    if veiculo and limpo.endswith(f" - {veiculo}"):
        return limpo[: -len(f" - {veiculo}")].strip()
    return limpo


def _parse_rss_noticias(xml_texto: str) -> list[tuple[NoticiaExterna, str]]:
    """Devolve (notícia, texto_para_filtro) por item do feed."""
    raiz = ElementTree.fromstring(xml_texto)
    itens: list[tuple[NoticiaExterna, str]] = []

    for item in raiz.iterfind(".//channel/item"):
        titulo_bruto = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not titulo_bruto or not link:
            continue

        veiculo = (item.findtext("source") or "").strip() or None
        descricao = item.findtext("description") or ""
        noticia = NoticiaExterna(
            titulo=_limpar_titulo_noticia(titulo_bruto, veiculo),
            url=link,
            veiculo=veiculo,
            data=_parse_data_rss(item.findtext("pubDate")),
        )
        itens.append((noticia, f"{titulo_bruto} {descricao}"))

    return itens


async def _buscar_noticias_google(
    client: httpx.AsyncClient, nome: str
) -> list[tuple[NoticiaExterna, str]]:
    resposta = await client.get(
        _GOOGLE_NEWS_BASE,
        params={
            # Aspas forçam a busca pela expressão exata do nome completo.
            "q": f'"{nome}"',
            "hl": "pt-BR",
            "gl": "BR",
            "ceid": "BR:pt-150",
        },
    )
    resposta.raise_for_status()
    return _parse_rss_noticias(resposta.text)


def _termos_distintivos_cv(texto_curriculo: Optional[str], limite: int = 12) -> list[str]:
    """Palavras recorrentes e específicas do CV (ex.: 'odontologia').

    Servem para confirmar que a notícia fala do docente certo. Termos genéricos
    de currículo entram em `_STOPWORDS_CV` e são descartados.
    """
    if not texto_curriculo:
        return []

    tokens = re.findall(r"[A-Za-zÀ-ÿ]{5,}", texto_curriculo)
    frequencia: dict[str, int] = {}
    for token in tokens:
        chave = remover_acentos(token).lower()
        if chave in _STOPWORDS_CV:
            continue
        frequencia[chave] = frequencia.get(chave, 0) + 1

    candidatos = [termo for termo, total in frequencia.items() if total >= 3]
    candidatos.sort(key=lambda termo: frequencia[termo], reverse=True)
    return candidatos[:limite]


# Quantas partes um nome precisa ter para a query por expressão exata bastar como
# prova de que a matéria é sobre a pessoa. "Aline Guerra Aquilante" identifica bem
# sozinho; "Ana Silva" não, e aí o nome também tem de aparecer no texto do item.
# Ver _filtrar_noticias para as duas réguas que este limiar separa.
_MIN_PARTES_NOME_DISTINTIVO = 3


def _filtrar_noticias(
    itens: list[tuple[NoticiaExterna, str]],
    *,
    nome: str,
    texto_curriculo: Optional[str],
    limite: int,
) -> list[NoticiaExterna]:
    """Notícias sobre o docente, da mais recente para a mais antiga.

    O texto de um item do RSS é só `título + <a href>`: o nome do docente
    aparece ali apenas quando está na manchete, o que é raro fora de celebridade.
    Exigir o nome no item derrubava praticamente todo o feed — inclusive matérias
    legítimas, como a do docente citado no corpo da reportagem.

    Por isso a régua depende do tamanho do nome:

    - **Nome completo (3+ partes)**: a query já é por expressão exata
      (`q="Nome Completo"`), então o Google garante o nome no *artigo*. Aqui o
      termo de contexto (afiliação, termo acadêmico ou termo recorrente do CV) é
      o que faz a guarda: mantém a matéria universitária e descarta o resultado
      aproximado que o feed devolve junto.
    - **Nome curto (< 3 partes)**: "Ana Silva" identifica mal demais para
      confiar na query, então continua valendo o critério duplo — nome no texto
      do item **e** contexto.

    O corte por `limite` vem **depois** da ordenação, e não durante a varredura:
    o Google News devolve o feed por relevância, não por data, então cortar
    antes entregaria "as mais recentes entre as primeiras do feed" — uma matéria
    de ontem que aparecesse em décimo lugar ficaria de fora em favor de uma de
    2019 no topo.
    """
    nome_chave = chave_comparacao(nome)
    nome_curto = len(nome.split()) < _MIN_PARTES_NOME_DISTINTIVO
    contexto = (
        [chave_comparacao(termo) for termo in _afiliacoes_alvo()]
        + list(_TERMOS_ACADEMICOS)
        + _termos_distintivos_cv(texto_curriculo)
    )

    aprovadas: list[NoticiaExterna] = []
    vistos: set[str] = set()
    for noticia, texto_filtro in itens:
        alvo = chave_comparacao(texto_filtro)
        if nome_curto and nome_chave not in alvo:
            continue
        if not any(termo and termo in alvo for termo in contexto):
            continue
        if noticia.url in vistos:
            continue
        vistos.add(noticia.url)
        aprovadas.append(noticia)

    # Ordenação estável: no empate de data vale a ordem do feed, que é por
    # relevância. Notícia sem pubDate legível vai para o fim e pode cair fora do
    # corte — sem data não há como afirmar que é recente.
    aprovadas.sort(
        key=lambda noticia: (noticia.data is not None, noticia.data or date.min),
        reverse=True,
    )
    return aprovadas[:limite]


# --------------------------------------------------------------------------- #
# Desambiguação
# --------------------------------------------------------------------------- #


def _titulos_no_curriculo(
    obras: list[ObraExterna], texto_curriculo: Optional[str]
) -> int:
    """Quantos títulos do OpenAlex aparecem no texto do próprio currículo.

    É o sinal mais forte de que o autor é a pessoa certa: o docente listou
    aquela publicação no Lattes.
    """
    if not texto_curriculo:
        return 0

    alvo = chave_comparacao(texto_curriculo)
    casados = 0
    for obra in obras:
        titulo = chave_comparacao(obra.titulo)
        # Títulos curtos demais casam por acaso ("Editorial", "Apresentação").
        if len(titulo) < 25:
            continue
        if titulo in alvo:
            casados += 1
    return casados


def _avaliar_confianca(
    *,
    nome: str,
    autor: Optional[_AutorOpenAlex],
    obras: list[ObraExterna],
    texto_curriculo: Optional[str],
) -> tuple[Confianca, int, list[str]]:
    if autor is None:
        return "baixa", 0, []

    score = 0
    criterios: list[str] = []

    afiliacao_chave = chave_comparacao(autor.afiliacao or "")
    for alvo in _afiliacoes_alvo():
        if afiliacao_chave and chave_comparacao(alvo) in afiliacao_chave:
            score += 3
            criterios.append(f"afiliação casa com '{alvo}'")
            break

    nome_chave = chave_comparacao(nome)
    nomes_autor = [autor.display_name, *autor.alternativas]
    if any(chave_comparacao(candidato) == nome_chave for candidato in nomes_autor):
        score += 2
        criterios.append("nome idêntico ao registrado no OpenAlex")

    casados = _titulos_no_curriculo(obras, texto_curriculo)
    if casados:
        pontos = min(casados, 2) * 2
        score += pontos
        criterios.append(
            f"{casados} título(s) do OpenAlex constam no currículo Lattes"
        )

    if (autor.country_code or "").upper() == "BR":
        score += 1
        criterios.append("instituição no Brasil")

    if score >= _SCORE_ALTA:
        return "alta", score, criterios
    if score >= _SCORE_MEDIA:
        return "media", score, criterios
    return "baixa", score, criterios


def _melhor_autor(
    autores: list[_AutorOpenAlex],
    *,
    nome: str,
    texto_curriculo: Optional[str],
) -> Optional[_AutorOpenAlex]:
    """Escolhe o candidato com melhor score, sem consultar obras ainda.

    A checagem por títulos do CV é cara (uma chamada de obras por autor), então
    aqui a decisão usa só afiliação, nome e país; o score definitivo é
    recalculado depois, já com as obras do escolhido.
    """
    if not autores:
        return None

    def parcial(autor: _AutorOpenAlex) -> tuple[int, int]:
        _, score, _ = _avaliar_confianca(
            nome=nome, autor=autor, obras=[], texto_curriculo=texto_curriculo
        )
        return score, autor.works_count

    return max(autores, key=parcial)


# --------------------------------------------------------------------------- #
# Entrada pública
# --------------------------------------------------------------------------- #


async def _coletar_academico(
    client: httpx.AsyncClient,
    nome: str,
    *,
    texto_curriculo: Optional[str],
    erros: list[str],
    log: Optional[LogFn],
) -> tuple[Optional[_AutorOpenAlex], list[ObraExterna]]:
    try:
        autores = await _buscar_autores_openalex(client, nome)
    except Exception as exc:
        erros.append(f"OpenAlex (autores): {exc}")
        if log:
            log(f"Falha ao consultar autores no OpenAlex para '{nome}': {exc}")
        return None, []

    autor = _melhor_autor(autores, nome=nome, texto_curriculo=texto_curriculo)
    if autor is None:
        if log:
            log(f"Nenhum autor correspondente encontrado no OpenAlex para '{nome}'.")
        return None, []

    try:
        obras = await _buscar_obras_openalex(
            client, autor.id, _env_int("PERFIL_EXTERNO_OBRAS_MAX", 10)
        )
    except Exception as exc:
        erros.append(f"OpenAlex (obras): {exc}")
        if log:
            log(f"Falha ao consultar obras no OpenAlex para '{nome}': {exc}")
        obras = []

    return autor, obras


async def _coletar_noticias(
    client: httpx.AsyncClient,
    nome: str,
    *,
    texto_curriculo: Optional[str],
    erros: list[str],
    log: Optional[LogFn],
) -> list[NoticiaExterna]:
    try:
        itens = await _buscar_noticias_google(client, nome)
    except Exception as exc:
        erros.append(f"Google News: {exc}")
        if log:
            log(f"Falha ao consultar notícias para '{nome}': {exc}")
        return []

    return _filtrar_noticias(
        itens,
        nome=nome,
        texto_curriculo=texto_curriculo,
        limite=_env_int("PERFIL_EXTERNO_NOTICIAS_MAX", 5),
    )


async def coletar_perfil_externo(
    nome: str,
    *,
    texto_curriculo: Optional[str] = None,
    log: Optional[LogFn] = None,
) -> Optional[PerfilExterno]:
    """Coleta produção acadêmica e notícias sobre o docente.

    `texto_curriculo` é opcional e melhora bastante a desambiguação: com ele dá
    para confirmar o autor pelos títulos que constam no próprio Lattes.

    Retorna `None` quando o enriquecimento está desligado ou o nome é vazio.
    Nunca levanta exceção: falhas de rede viram itens em `PerfilExterno.erros`.
    """
    if not habilitado():
        return None

    nome_limpo = " ".join(nome.split())
    if not nome_limpo:
        return None

    erros: list[str] = []
    fontes: list[str] = []
    timeout = _env_float("PERFIL_EXTERNO_TIMEOUT", 8.0)

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": _user_agent()},
        ) as client:
            (autor, obras), noticias = await asyncio.gather(
                _coletar_academico(
                    client,
                    nome_limpo,
                    texto_curriculo=texto_curriculo,
                    erros=erros,
                    log=log,
                ),
                _coletar_noticias(
                    client,
                    nome_limpo,
                    texto_curriculo=texto_curriculo,
                    erros=erros,
                    log=log,
                ),
            )
    except Exception as exc:
        # Falha na criação do client ou algo fora das fontes: devolve perfil
        # vazio em vez de derrubar o scraping do currículo.
        if log:
            log(f"Falha inesperada no enriquecimento externo de '{nome_limpo}': {exc}")
        return PerfilExterno(nome_busca=nome_limpo, erros=(str(exc),))

    if autor is not None:
        fontes.append("openalex")
    if noticias:
        fontes.append("google-news")

    confianca, score, criterios = _avaliar_confianca(
        nome=nome_limpo, autor=autor, obras=obras, texto_curriculo=texto_curriculo
    )

    perfil = PerfilExterno(
        nome_busca=nome_limpo,
        confianca=confianca,
        score=score,
        openalex_author_id=autor.id if autor else None,
        openalex_url=autor.id if autor else None,
        orcid=autor.orcid if autor else None,
        afiliacao=autor.afiliacao if autor else None,
        total_obras=autor.works_count if autor else 0,
        total_citacoes=autor.cited_by_count if autor else 0,
        h_index=autor.h_index if autor else None,
        obras=tuple(obras),
        noticias=tuple(noticias),
        criterios=tuple(criterios),
        fontes=tuple(fontes),
        erros=tuple(erros),
    )

    if log:
        if perfil.publicavel:
            log(
                f"Perfil externo de '{nome_limpo}': confiança alta (score {score}) — "
                f"{len(perfil.obras)} obra(s), {len(perfil.noticias)} notícia(s). "
                f"Critérios: {'; '.join(criterios) or 'nenhum'}."
            )
        else:
            log(
                f"Perfil externo de '{nome_limpo}' descartado por confiança "
                f"{confianca} (score {score}); não será exibido nem exportado. "
                f"Critérios: {'; '.join(criterios) or 'nenhum'}."
            )

    return perfil


def perfil_to_payload(perfil: Optional[PerfilExterno]) -> Optional[dict[str, Any]]:
    """Serializa o perfil para a resposta da API, respeitando a confiança."""
    if perfil is None or not perfil.publicavel:
        return None

    return {
        "nome_busca": perfil.nome_busca,
        "confianca": perfil.confianca,
        "score": perfil.score,
        "openalex_author_id": perfil.openalex_author_id,
        "openalex_url": perfil.openalex_url,
        "orcid": perfil.orcid,
        "afiliacao": perfil.afiliacao,
        "total_obras": perfil.total_obras,
        "total_citacoes": perfil.total_citacoes,
        "h_index": perfil.h_index,
        "criterios": list(perfil.criterios),
        "fontes": list(perfil.fontes),
        "obras": [
            {
                "titulo": obra.titulo,
                "ano": obra.ano,
                "veiculo": obra.veiculo,
                "doi": obra.doi,
                "url": obra.url,
                "citacoes": obra.citacoes,
            }
            for obra in perfil.obras
        ],
        "noticias": [
            {
                "titulo": noticia.titulo,
                "url": noticia.url,
                "veiculo": noticia.veiculo,
                "data": noticia.data.isoformat() if noticia.data else None,
            }
            for noticia in perfil.noticias
        ],
    }
