from datetime import date
from types import SimpleNamespace

import pytest

from src.core import summarizer
from src.core.perfil_externo import BibliometriaExterna, NoticiaExterna
from src.core.summarizer import (
    _INSTRUCAO_BIBLIOMETRIA,
    _PROMPT_SISTEMA,
    _build_system_prompt,
    _build_user_prompt,
)


def test_system_prompt_includes_academic_hierarchy_rules_for_ai_summary():
    assert "Trate doutorado como o maior grau acadêmico formal." in _PROMPT_SISTEMA
    assert (
        "Não trate pós-doutorado como um novo título acima de doutorado"
        in _PROMPT_SISTEMA
    )
    assert "livre-docência" in _PROMPT_SISTEMA
    assert "maior titulação formal" in _PROMPT_SISTEMA


def test_build_user_prompt_includes_pdf_and_html_sources_with_priority_guidance():
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="Nome: Pessoa do PDF\nFormacao: Doutorado",
        texto_html="Nome: Pessoa do HTML\nPos-doutorado: Sim",
    )

    assert "Use o PDF como fonte principal" in prompt
    assert "[FONTE PRINCIPAL: PDF]" in prompt
    assert "Nome: Pessoa do PDF" in prompt
    assert "[FONTE AUXILIAR: HTML]" in prompt
    assert "Pos-doutorado: Sim" in prompt


def test_build_user_prompt_marks_missing_sources_explicitly():
    prompt = _build_user_prompt("texto consolidado", texto_pdf="", texto_html="")

    assert "texto consolidado" in prompt
    assert "[FONTE PRINCIPAL: PDF]" not in prompt


def test_build_user_prompt_marks_missing_pdf_and_uses_html_when_available():
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="",
        texto_html="Instituicao atual: Exemplo via HTML",
    )

    assert "PDF não disponível ou sem texto utilizável." in prompt
    assert "Instituicao atual: Exemplo via HTML" in prompt


def test_build_system_prompt_sem_secao_usa_prompt_completo():
    assert _build_system_prompt(None) == _PROMPT_SISTEMA


def test_build_system_prompt_secao_conhecida_foca_na_secao():
    prompt = _build_system_prompt("atuacao")

    assert prompt != _PROMPT_SISTEMA
    assert "Atuação profissional" in prompt
    assert "vínculos institucionais" in prompt
    # Mantém a regra obrigatória de saída em bloco markdown.
    assert "```markdown" in prompt
    # Não deve listar a estrutura completa de 6 seções.
    assert "Resumo Executivo" not in prompt


def test_build_system_prompt_secao_desconhecida_cai_para_completo():
    assert _build_system_prompt("inexistente") == _PROMPT_SISTEMA


def test_build_user_prompt_menciona_secao_quando_informada():
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="Universidade X, Professor",
        texto_html="",
        secao_label="Atuação profissional",
    )

    assert "seção 'Atuação profissional'" in prompt


def test_prompt_completo_pede_o_curso_de_cada_formacao():
    """O nível sozinho ('Doutorado') não diz a área de origem do docente."""
    assert "Registre o **curso** de cada formação" in _PROMPT_SISTEMA
    assert 'o curso é a parte após "em"' in _PROMPT_SISTEMA
    assert "colunas: Nível | Curso | Instituição | Ano" in _PROMPT_SISTEMA
    assert "(curso, ano e instituição, quando disponível)" in _PROMPT_SISTEMA


def test_instrucao_da_secao_formacao_tambem_pede_o_curso():
    prompt = _build_system_prompt("formacao")
    assert "Registre o curso de cada formação" in prompt
    assert "Nível | Curso | Instituição | Ano" in prompt


def test_build_user_prompt_anexa_bloco_de_noticias():
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="conteudo do pdf",
        texto_html="conteudo do html",
        noticias=(
            NoticiaExterna(
                titulo="Docente lidera projeto de extensão",
                url="https://exemplo.com/a",
                veiculo="Jornal A",
                data=date(2026, 8, 4),
            ),
            NoticiaExterna(
                titulo="Notícia sem veículo nem data",
                url="https://exemplo.com/b",
            ),
        ),
    )

    assert "[FONTE EXTERNA: NOTÍCIAS]" in prompt
    assert "- Docente lidera projeto de extensão (Jornal A, 04/08/2026)" in prompt
    # Sem veículo e sem data, o item entra sem parênteses vazios.
    assert prompt.rstrip().endswith("- Notícia sem veículo nem data")
    # O bloco de notícias vem depois das fontes do currículo.
    assert prompt.index("[FONTE PRINCIPAL: PDF]") < prompt.index(
        "[FONTE EXTERNA: NOTÍCIAS]"
    )


def test_build_user_prompt_sem_noticias_nao_cria_bloco_vazio():
    """Ausência de notícia é o caso comum; anunciá-la só gastaria contexto."""
    prompt = _build_user_prompt("texto consolidado", texto_pdf="pdf", texto_html="html")

    assert "FONTE EXTERNA" not in prompt


def test_system_prompt_ganha_regras_de_noticia_apenas_quando_ha_noticia():
    sem = _build_system_prompt(None)
    com = _build_system_prompt(None, com_noticias=True)

    assert sem == _PROMPT_SISTEMA
    assert "Notícias e Menções na Imprensa" in com
    assert "NÃO do currículo" in com
    # A notícia não pode virar fonte de titulação/vínculo/produção.
    assert "Não use notícia como fonte das outras seções" in com


def test_resumo_de_secao_nao_recebe_regras_de_noticia():
    """Quem pede uma seção do Lattes não pediu imprensa."""
    prompt = _build_system_prompt("formacao", com_noticias=True)

    assert "Notícias e Menções na Imprensa" not in prompt


def test_build_user_prompt_anexa_bloco_de_bibliometria():
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="conteudo do pdf",
        texto_html="conteudo do html",
        bibliometria=BibliometriaExterna(
            total_obras=180, total_citacoes=2400, h_index=24
        ),
    )

    assert "[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]" in prompt
    assert "- Obras indexadas: 180" in prompt
    assert "- Citações recebidas: 2400" in prompt
    assert "- h-index: 24" in prompt
    # As fontes externas vêm depois das do currículo, que é o dado principal.
    assert prompt.index("[FONTE PRINCIPAL: PDF]") < prompt.index(
        "[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]"
    )


def test_bloco_de_bibliometria_omite_indicador_ausente():
    """Sem h-index no bloco, o prompt de sistema proíbe mencionar h-index."""
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="pdf",
        bibliometria=BibliometriaExterna(total_obras=12),
    )

    assert "- Obras indexadas: 12" in prompt
    assert "h-index" not in prompt
    assert "Citações recebidas" not in prompt


def test_bibliometria_vem_antes_das_noticias_no_prompt():
    """Mesma ordem em que o prompt de sistema descreve os dois blocos."""
    prompt = _build_user_prompt(
        "texto consolidado",
        texto_pdf="pdf",
        bibliometria=BibliometriaExterna(total_obras=180),
        noticias=(NoticiaExterna(titulo="Manchete", url="https://exemplo.com/a"),),
    )

    assert prompt.index("[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]") < prompt.index(
        "[FONTE EXTERNA: NOTÍCIAS]"
    )


def test_system_prompt_ganha_regras_de_bibliometria_apenas_quando_ha_indicador():
    sem = _build_system_prompt(None)
    com = _build_system_prompt(None, com_bibliometria=True)

    assert sem == _PROMPT_SISTEMA
    assert "[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]" in com
    # A frase entra no Resumo Executivo, e sempre atribuída ao OpenAlex.
    assert "Acrescente ao Resumo Executivo UMA frase" in com
    assert "sempre nomeando a fonte" in com
    # O formato-modelo usa placeholders, e a instrução inteira não tem dígito:
    # com números plausíveis no exemplo ("180 obras, h-index 24"), o qwen3:14b
    # copiou o exemplo em vez de ler o bloco do prompt do usuário.
    assert "<obras indexadas>" in com
    assert "<h-index>" in com
    assert not any(char.isdigit() for char in _INSTRUCAO_BIBLIOMETRIA)
    # O indicador externo não substitui o que sai do currículo.
    assert "não calcule, não estime" in com.lower()
    assert (
        "Não use esses indicadores como fonte de titulação, de vínculo institucional"
        in com
    )


def test_resumo_de_secao_nao_recebe_regras_de_bibliometria():
    """Recorte do Lattes não recebe fonte externa — vale para os dois blocos."""
    prompt = _build_system_prompt(
        "producao", com_noticias=True, com_bibliometria=True
    )

    assert "OpenAlex" not in prompt
    assert "Notícias e Menções na Imprensa" not in prompt


class _FakeClientOpenAI:
    """Só o caminho `client.chat.completions.create` que o summarizer usa."""

    def __init__(self, capturado: dict) -> None:
        self._capturado = capturado
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self._capturado["messages"] = kwargs["messages"]
        mensagem = SimpleNamespace(content="## Resumo")
        return SimpleNamespace(choices=[SimpleNamespace(message=mensagem)])


@pytest.mark.parametrize("provedor", ["openai", "ollama"])
async def test_bibliometria_chega_ao_prompt_de_usuario_de_cada_provedor(
    monkeypatch, provedor
) -> None:
    """Quem monta o prompt de sistema tem de mandar o bloco junto.

    Cada provedor repete a dupla de chamadas, e anunciar sem enviar é o pior dos
    mundos: o prompt de sistema manda escrever uma frase com indicadores que não
    chegaram. Cobre o wiring por provedor, que os testes dos construtores de
    prompt não alcançam.
    """
    capturado: dict = {}
    monkeypatch.setattr(
        summarizer, "AsyncOpenAI", lambda **_kwargs: _FakeClientOpenAI(capturado)
    )

    async def fake_base_url(api_key, log=None):
        return "http://localhost:11434"

    monkeypatch.setattr(summarizer, "_resolver_base_url_ollama", fake_base_url)

    await summarizer.resumir_curriculo(
        "texto consolidado",
        texto_pdf="conteudo do pdf",
        api_key="chave",
        modelo="modelo",
        provedor=provedor,
        bibliometria=BibliometriaExterna(total_obras=180, h_index=24),
    )

    system, user = capturado["messages"]
    assert "[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]" in system["content"]
    assert "[FONTE EXTERNA: PRODUÇÃO (OpenAlex)]" in user["content"]
    assert "- Obras indexadas: 180" in user["content"]
    assert "- h-index: 24" in user["content"]
