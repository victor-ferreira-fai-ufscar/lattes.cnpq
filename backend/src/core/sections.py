"""Segmentação heurística do texto do currículo Lattes por seção.

Usado pelo resumo por seção: dado o texto bruto coletado pelo scraper (texto do
PDF ou do HTML), recorta o trecho de uma seção específica do Lattes (ex.: Atuação
Profissional) para enviar apenas ela ao modelo de IA. Quando o recorte falha, o
chamador cai no modo "foco por prompt", enviando o currículo inteiro e instruindo
o modelo a resumir apenas a seção pedida.

A segmentação trabalha sobre o texto bruto de UMA fonte por vez (texto_pdf OU
texto_html), nunca sobre um texto fundido/deduplicado, porque ela depende da
ordem original das linhas para detectar onde cada seção começa e termina.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

# Tamanho mínimo (em caracteres) de um recorte para ser considerado útil. Abaixo
# disso provavelmente capturamos só o cabeçalho sem conteúdo, então tratamos como
# falha de recorte (cai no fallback por prompt).
_MIN_CHARS_SECAO = 40

# Sufixo máximo tolerado após um cabeçalho na mesma linha. Cobre casos do PDF em
# que o cabeçalho vem concatenado com uma contagem curta (ex.: "Orientações ... 3"),
# sem confundir frases longas do corpo do texto com cabeçalhos.
_MAX_SUFIXO_CABECALHO = 60


def _remover_acentos(texto: str) -> str:
    nfkd = unicodedata.normalize("NFD", texto)
    return "".join(ch for ch in nfkd if unicodedata.category(ch) != "Mn")


def _normalizar(texto: str) -> str:
    return " ".join(_remover_acentos(texto).lower().split())


# Seções oferecidas no seletor de resumo, na ordem em que aparecem no Lattes.
# Cada entrada tem o rótulo exibido e os cabeçalhos (já em forma humana) que
# marcam o início daquela seção no currículo.
SECOES_RESUMO: dict[str, dict] = {
    "resumo": {
        "label": "Resumo informado pelo autor",
        "cabecalhos": [
            "Resumo informado pelo autor",
        ],
    },
    "formacao": {
        "label": "Formação acadêmica/titulação",
        "cabecalhos": [
            "Formação acadêmica/titulação",
            "Formação acadêmica / titulação",
            "Formação acadêmica",
        ],
    },
    "atuacao": {
        "label": "Atuação profissional",
        "cabecalhos": [
            "Atuação Profissional",
        ],
    },
    "producao": {
        "label": "Produção bibliográfica",
        "cabecalhos": [
            "Produção bibliográfica",
        ],
    },
    "orientacoes": {
        "label": "Orientações",
        "cabecalhos": [
            "Orientações e supervisões",
            "Orientações concluídas",
            "Orientações em andamento",
            "Orientações",
        ],
    },
    "projetos": {
        "label": "Projetos de pesquisa",
        "cabecalhos": [
            "Projetos de pesquisa",
            "Linhas de pesquisa",
        ],
    },
}

SECOES_VALIDAS: frozenset[str] = frozenset(SECOES_RESUMO)

# Cabeçalhos de topo do Lattes que NÃO entram no seletor, mas servem como
# fronteiras: marcam o fim da seção-alvo anterior. Mantê-los aqui evita que um
# recorte (ex.: Produção bibliográfica) avance por engano para a seção seguinte.
_CABECALHOS_FRONTEIRA: tuple[str, ...] = (
    "Identificação",
    "Endereço",
    "Pós-doutorado",
    "Pós-doutorado e Livre-docência",
    "Formação Complementar",
    "Membro de corpo editorial",
    "Membro de comitê de assessoramento",
    "Revisor de periódico",
    "Revisor de projeto de fomento",
    "Áreas de atuação",
    "Idiomas",
    "Prêmios e títulos",
    "Produção",
    "Produção técnica",
    "Produção artística/cultural",
    "Demais tipos de produção técnica",
    "Demais trabalhos",
    "Bancas",
    "Participação em bancas de trabalhos de conclusão",
    "Participação em bancas de comissões julgadoras",
    "Eventos",
    "Participação em eventos",
    "Organização de eventos",
    "Educação e Popularização de C & T",
    "Inovação",
    "Outras informações relevantes",
    "Totais de produção",
)


def _norm_cabecalhos(cabecalhos) -> list[str]:
    return [_normalizar(c) for c in cabecalhos]


# Pré-computa as formas normalizadas usadas no casamento de cabeçalhos.
_SECOES_NORM: dict[str, list[str]] = {
    key: _norm_cabecalhos(info["cabecalhos"]) for key, info in SECOES_RESUMO.items()
}
_FRONTEIRAS_NORM: tuple[str, ...] = tuple(_norm_cabecalhos(_CABECALHOS_FRONTEIRA))


def label_da_secao(secao: str | None) -> str | None:
    """Rótulo legível de uma seção, ou None para 'currículo completo'."""
    if not secao:
        return None
    info = SECOES_RESUMO.get(secao)
    return info["label"] if info else None


def _linha_casa_cabecalho(linha_norm: str, cabecalho_norm: str) -> bool:
    if linha_norm == cabecalho_norm:
        return True
    # Tolera um sufixo curto após o cabeçalho (ex.: PDF concatenando contagens).
    if linha_norm.startswith(cabecalho_norm):
        resto = linha_norm[len(cabecalho_norm) :].strip(" :-")
        return len(resto) <= _MAX_SUFIXO_CABECALHO
    return False


def _classificar_linha(linha_norm: str) -> str | None:
    """Classifica uma linha como cabeçalho de seção-alvo, de fronteira, ou nada.

    Retorna a key da seção (ex.: "atuacao"), o marcador "__fronteira__" para um
    cabeçalho de topo que não está no seletor, ou None quando a linha não é um
    cabeçalho conhecido.
    """
    for key, cabecalhos_norm in _SECOES_NORM.items():
        for cabecalho_norm in cabecalhos_norm:
            if _linha_casa_cabecalho(linha_norm, cabecalho_norm):
                return key

    for cabecalho_norm in _FRONTEIRAS_NORM:
        if _linha_casa_cabecalho(linha_norm, cabecalho_norm):
            return "__fronteira__"

    return None


def _recortar_secao(texto: str, secao: str) -> str | None:
    """Recorta o trecho de uma seção de um texto bruto, ou None se não achar."""
    if not texto or secao not in SECOES_VALIDAS:
        return None

    linhas = [
        linha.strip()
        for linha in texto.replace("\r", "").splitlines()
        if linha.strip()
    ]
    if not linhas:
        return None

    # Mapeia cada cabeçalho encontrado: (índice da linha, key/__fronteira__).
    hits: list[tuple[int, str]] = []
    for indice, linha in enumerate(linhas):
        key = _classificar_linha(_normalizar(linha))
        if key:
            hits.append((indice, key))

    # Encontra o primeiro cabeçalho da seção-alvo e estende até o próximo
    # cabeçalho de outra seção/fronteira, fundindo subcabeçalhos da mesma seção
    # (ex.: "Orientações concluídas" + "Orientações em andamento").
    for posicao, (linha_inicio, key) in enumerate(hits):
        if key != secao:
            continue

        fim = len(linhas)
        for linha_proximo, key_proximo in hits[posicao + 1 :]:
            if key_proximo != secao:
                fim = linha_proximo
                break

        trecho = "\n".join(linhas[linha_inicio:fim]).strip()
        if len(trecho) >= _MIN_CHARS_SECAO:
            return trecho
        return None

    return None


@dataclass(frozen=True)
class SecaoRecorte:
    """Resultado do recorte de uma seção a partir das fontes do currículo."""

    secao: str
    texto: str
    texto_pdf: str
    texto_html: str
    fonte: str  # "pdf" ou "html": de onde veio o texto principal do recorte


def extrair_secao(
    texto_pdf: str | None,
    texto_html: str | None,
    secao: str,
    *,
    fonte_preferida: str = "pdf",
) -> SecaoRecorte | None:
    """Recorta uma seção a partir do PDF e/ou HTML do currículo.

    Recorta cada fonte de forma independente e escolhe a principal pela
    `fonte_preferida` (espelhando a decisão PDF-vs-HTML do scraper). Retorna None
    quando nenhuma fonte contém a seção, sinalizando ao chamador que deve cair no
    modo de foco por prompt sobre o currículo inteiro.
    """
    if secao not in SECOES_VALIDAS:
        return None

    recorte_pdf = _recortar_secao(texto_pdf or "", secao) or ""
    recorte_html = _recortar_secao(texto_html or "", secao) or ""

    if not recorte_pdf and not recorte_html:
        return None

    prefere_pdf = fonte_preferida != "html"
    if prefere_pdf:
        principal, fonte = (recorte_pdf, "pdf") if recorte_pdf else (recorte_html, "html")
    else:
        principal, fonte = (recorte_html, "html") if recorte_html else (recorte_pdf, "pdf")

    return SecaoRecorte(
        secao=secao,
        texto=principal,
        texto_pdf=recorte_pdf,
        texto_html=recorte_html,
        fonte=fonte,
    )


def segmentar(texto: str) -> dict[str, str]:
    """Retorna um dicionário {key_secao: trecho} com as seções encontradas.

    Útil para inspeção/depuração e testes. Seções ausentes simplesmente não
    aparecem no resultado.
    """
    resultado: dict[str, str] = {}
    for secao in SECOES_RESUMO:
        trecho = _recortar_secao(texto, secao)
        if trecho:
            resultado[secao] = trecho
    return resultado
