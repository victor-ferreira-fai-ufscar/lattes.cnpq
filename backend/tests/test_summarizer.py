from datetime import date

from src.core.perfil_externo import NoticiaExterna
from src.core.summarizer import (
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
