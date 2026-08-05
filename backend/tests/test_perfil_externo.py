import json

import httpx
import pytest

from src.core import perfil_externo as pe
from src.core.perfil_externo import (
    ObraExterna,
    PerfilExterno,
    coletar_perfil_externo,
    perfil_to_payload,
)
from src.core import perfil_externo_cache


NOME = "Aline Guerra Aquilante"


def _autor_openalex(
    *,
    display_name: str = NOME,
    instituicao: str | None = "Universidade Federal de São Carlos",
    country_code: str | None = "BR",
) -> dict:
    return {
        "id": "https://openalex.org/A5001",
        "display_name": display_name,
        "display_name_alternatives": ["A. G. Aquilante"],
        "works_count": 42,
        "cited_by_count": 315,
        "summary_stats": {"h_index": 11},
        "ids": {"orcid": "https://orcid.org/0000-0002-0000-0001"},
        "last_known_institutions": (
            [{"display_name": instituicao, "country_code": country_code}]
            if instituicao
            else []
        ),
    }


def _obra_openalex(titulo: str, citacoes: int = 30) -> dict:
    return {
        "id": f"https://openalex.org/W{abs(hash(titulo)) % 10000}",
        "title": titulo,
        "publication_year": 2021,
        "doi": "https://doi.org/10.1000/exemplo",
        "cited_by_count": citacoes,
        "primary_location": {"source": {"display_name": "Revista de Saúde Coletiva"}},
    }


RSS_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
{itens}
</channel></rss>
"""

ITEM_TEMPLATE = """<item>
  <title>{titulo}</title>
  <link>{link}</link>
  <pubDate>Tue, 04 Aug 2026 09:30:00 GMT</pubDate>
  <source url="https://exemplo.com">{veiculo}</source>
  <description>{descricao}</description>
</item>"""


def _rss(*itens: str) -> str:
    return RSS_TEMPLATE.format(itens="\n".join(itens))


def _mock_transport(
    *,
    autores: list[dict] | None = None,
    obras: list[dict] | None = None,
    rss: str | None = None,
    falhar_rss: bool = False,
    falhar_autores: bool = False,
):
    """Transport httpx que responde OpenAlex e Google News sem sair da máquina."""

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)

        if "openalex.org/authors" in url:
            if falhar_autores:
                raise httpx.ConnectError("sem rede", request=request)
            return httpx.Response(
                200, json={"results": autores if autores is not None else []}
            )

        if "openalex.org/works" in url:
            return httpx.Response(
                200, json={"results": obras if obras is not None else []}
            )

        if "news.google.com" in url:
            if falhar_rss:
                raise httpx.ReadTimeout("timeout no feed", request=request)
            return httpx.Response(200, text=rss if rss is not None else _rss())

        raise AssertionError(f"URL inesperada no teste: {url}")

    return httpx.MockTransport(handler)


@pytest.fixture(autouse=True)
def _ambiente_limpo(monkeypatch):
    monkeypatch.setenv("PERFIL_EXTERNO_ENABLED", "true")
    monkeypatch.setenv(
        "PERFIL_EXTERNO_AFILIACOES", "UFSCar,Universidade Federal de São Carlos,FAI"
    )
    monkeypatch.delenv("OPENALEX_MAILTO", raising=False)
    perfil_externo_cache.limpar_cache()
    yield
    perfil_externo_cache.limpar_cache()


@pytest.fixture
def cliente_mockado(monkeypatch):
    """Injeta um transport no AsyncClient criado dentro do módulo."""

    def _instalar(**kwargs):
        transport = _mock_transport(**kwargs)
        original = httpx.AsyncClient

        def factory(*args, **client_kwargs):
            client_kwargs["transport"] = transport
            return original(*args, **client_kwargs)

        monkeypatch.setattr(pe.httpx, "AsyncClient", factory)

    return _instalar


async def test_afiliacao_e_nome_dao_confianca_alta(cliente_mockado):
    cliente_mockado(
        autores=[_autor_openalex()],
        obras=[_obra_openalex("Determinantes sociais da saúde bucal em idosos")],
        rss=_rss(
            ITEM_TEMPLATE.format(
                titulo=f"{NOME} lidera pesquisa na UFSCar - Jornal da Cidade",
                link="https://exemplo.com/noticia-1",
                veiculo="Jornal da Cidade",
                descricao=f"A professora {NOME} coordena o projeto.",
            )
        ),
    )

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert perfil.confianca == "alta"
    assert perfil.publicavel is True
    # afiliação (3) + nome idêntico (2) + Brasil (1)
    assert perfil.score == 6
    assert perfil.h_index == 11
    assert perfil.total_citacoes == 315
    assert len(perfil.obras) == 1
    assert len(perfil.noticias) == 1
    assert perfil.noticias[0].veiculo == "Jornal da Cidade"
    # O sufixo " - Veículo" do Google News é removido do título.
    assert perfil.noticias[0].titulo.endswith("na UFSCar")
    assert set(perfil.fontes) == {"openalex", "google-news"}
    assert perfil.erros == ()


async def test_homonimo_sem_afiliacao_fica_com_confianca_baixa(cliente_mockado):
    cliente_mockado(
        autores=[
            _autor_openalex(
                display_name="A. Aquilante",
                instituicao="Some Foreign University",
                country_code="US",
            )
        ],
        obras=[_obra_openalex("Unrelated paper about polymers")],
        rss=_rss(),
    )

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert perfil.confianca == "baixa"
    assert perfil.publicavel is False
    # Nada de confiança baixa chega ao payload da API nem ao export.
    assert perfil_to_payload(perfil) is None


async def test_titulos_do_curriculo_desempatam_autor_sem_afiliacao(cliente_mockado):
    titulo = "Determinantes sociais da saúde bucal em idosos institucionalizados"
    cliente_mockado(
        autores=[
            _autor_openalex(instituicao="Universidade Estadual Paulista", country_code="BR")
        ],
        obras=[_obra_openalex(titulo)],
        rss=_rss(),
    )

    texto_curriculo = (
        "Formação acadêmica. Artigos publicados: "
        f"{titulo}. Revista de Saúde Coletiva, 2021."
    )

    perfil = await coletar_perfil_externo(NOME, texto_curriculo=texto_curriculo)

    assert perfil is not None
    # nome idêntico (2) + título casado (2) + Brasil (1)
    assert perfil.score == 5
    assert perfil.confianca == "alta"


async def test_falha_no_feed_de_noticias_nao_derruba_a_parte_academica(cliente_mockado):
    cliente_mockado(
        autores=[_autor_openalex()],
        obras=[_obra_openalex("Saúde coletiva e formação profissional")],
        falhar_rss=True,
    )

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert perfil.confianca == "alta"
    assert len(perfil.obras) == 1
    assert perfil.noticias == ()
    assert any("Google News" in erro for erro in perfil.erros)


async def test_falha_no_openalex_devolve_perfil_vazio_sem_excecao(cliente_mockado):
    cliente_mockado(falhar_autores=True, rss=_rss())

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert perfil.confianca == "baixa"
    assert perfil.openalex_author_id is None
    assert any("OpenAlex" in erro for erro in perfil.erros)


async def test_noticia_que_nao_cita_o_nome_e_descartada(cliente_mockado):
    """O feed do Google News devolve resultados aproximados, sem o nome."""
    cliente_mockado(
        autores=[_autor_openalex()],
        obras=[],
        rss=_rss(
            ITEM_TEMPLATE.format(
                titulo="Campus da UFSCar causa impacto na região - SMETAL",
                link="https://exemplo.com/campus",
                veiculo="SMETAL",
                descricao="Reportagem sobre o campus, sem citar a docente.",
            )
        ),
    )

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert perfil.noticias == ()


async def test_nome_curto_exige_contexto_academico(cliente_mockado):
    """'Ana Silva' é comum demais: só o nome não identifica a pessoa."""
    nome_curto = "Ana Silva"
    cliente_mockado(
        autores=[],
        obras=[],
        rss=_rss(
            ITEM_TEMPLATE.format(
                titulo=f"{nome_curto} vence campeonato de tênis - Portal Esportivo",
                link="https://exemplo.com/esporte",
                veiculo="Portal Esportivo",
                descricao="Final disputada no clube da cidade.",
            )
        ),
    )

    perfil = await coletar_perfil_externo(nome_curto)

    assert perfil is not None
    assert perfil.noticias == ()


async def test_nome_completo_dispensa_termo_de_contexto(cliente_mockado):
    """Com 3+ partes, o nome já identifica: exigir contexto perdia matérias reais."""
    cliente_mockado(
        autores=[_autor_openalex()],
        obras=[],
        rss=_rss(
            ITEM_TEMPLATE.format(
                titulo=f"{NOME} assume nova diretoria - Jornal Local",
                link="https://exemplo.com/diretoria",
                veiculo="Jornal Local",
                descricao="Anúncio feito nesta semana.",
            )
        ),
    )

    perfil = await coletar_perfil_externo(NOME)

    assert perfil is not None
    assert len(perfil.noticias) == 1
    assert perfil.noticias[0].veiculo == "Jornal Local"


async def test_flag_desligada_pula_o_enriquecimento(monkeypatch):
    monkeypatch.setenv("PERFIL_EXTERNO_ENABLED", "false")

    assert await coletar_perfil_externo(NOME) is None


async def test_cache_evita_segunda_coleta(cliente_mockado):
    chamadas = {"total": 0}
    original = pe.coletar_perfil_externo

    async def contando(*args, **kwargs):
        chamadas["total"] += 1
        return await original(*args, **kwargs)

    cliente_mockado(autores=[_autor_openalex()], obras=[], rss=_rss())
    import src.core.perfil_externo_cache as cache_mod

    cache_mod.coletar_perfil_externo = contando
    try:
        primeiro = await cache_mod.get_perfil_externo(NOME)
        segundo = await cache_mod.get_perfil_externo(NOME)
    finally:
        cache_mod.coletar_perfil_externo = original

    assert chamadas["total"] == 1
    assert primeiro is segundo


def test_payload_serializa_datas_e_listas():
    perfil = PerfilExterno(
        nome_busca=NOME,
        confianca="alta",
        score=6,
        openalex_author_id="https://openalex.org/A5001",
        total_obras=42,
        total_citacoes=315,
        h_index=11,
        obras=(ObraExterna(titulo="Obra", ano=2021, citacoes=30),),
        criterios=("afiliação casa com 'UFSCar'",),
        fontes=("openalex",),
    )

    payload = perfil_to_payload(perfil)

    assert payload is not None
    assert payload["obras"][0]["titulo"] == "Obra"
    assert payload["criterios"] == ["afiliação casa com 'UFSCar'"]
    # Serializável para a resposta HTTP sem tratamento extra.
    json.dumps(payload)
