from src.core.summarizer import _PROMPT_SISTEMA, _build_user_prompt


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
