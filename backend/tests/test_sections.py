from src.core.sections import (
    SECOES_VALIDAS,
    SecaoRecorte,
    extrair_secao,
    label_da_secao,
    segmentar,
)

# Currículo fictício no formato típico do Lattes (texto bruto), com cabeçalhos
# de seção em linhas próprias, como aparecem no inner_text/PDF.
CV_TEXTO = """\
Fulano de Tal
Identificação
Nome Fulano de Tal
Endereço
Universidade Federal de Exemplo
Resumo informado pelo autor
Pesquisador na área de engenharia de produção, com foco em otimização.
Atua em projetos de manufatura enxuta.
Formação acadêmica/titulação
2010 - 2014 Doutorado em Engenharia de Produção
2008 - 2010 Mestrado em Engenharia de Produção
Atuação Profissional
Universidade Federal de Exemplo, vínculo desde 2015
Professor Associado, regime de dedicação exclusiva
Áreas de atuação
Engenharia de Produção
Produção bibliográfica
Artigos completos publicados em periódicos
1. Artigo sobre manufatura enxuta. Revista de Engenharia, 2019.
2. Artigo sobre logística. Revista de Produção, 2020.
Orientações
Orientações e supervisões concluídas
Dissertação de mestrado: 4 orientações
Orientações e supervisões em andamento
Tese de doutorado: 2 orientações
Projetos de pesquisa
Projeto Alpha de otimização (2018 - 2020)
Projeto Beta de manufatura (2021 - atual)
"""


def test_extrair_atuacao_recorta_apenas_a_secao():
    recorte = extrair_secao(CV_TEXTO, None, "atuacao")

    assert recorte is not None
    assert isinstance(recorte, SecaoRecorte)
    assert recorte.fonte == "pdf"
    assert "Professor Associado" in recorte.texto
    assert "vínculo desde 2015" in recorte.texto
    # Não deve vazar para seções vizinhas.
    assert "Doutorado em Engenharia" not in recorte.texto
    assert "Engenharia de Produção" not in recorte.texto  # já é "Áreas de atuação"


def test_extrair_orientacoes_funde_subsecoes():
    recorte = extrair_secao(CV_TEXTO, None, "orientacoes")

    assert recorte is not None
    assert "Dissertação de mestrado: 4 orientações" in recorte.texto
    assert "Tese de doutorado: 2 orientações" in recorte.texto
    # Termina antes da próxima seção de topo.
    assert "Projeto Alpha" not in recorte.texto


def test_extrair_secao_no_fim_do_documento():
    recorte = extrair_secao(CV_TEXTO, None, "projetos")

    assert recorte is not None
    assert "Projeto Alpha de otimização" in recorte.texto
    assert "Projeto Beta de manufatura" in recorte.texto


def test_extrair_resumo_termina_antes_da_formacao():
    recorte = extrair_secao(CV_TEXTO, None, "resumo")

    assert recorte is not None
    assert "otimização" in recorte.texto
    assert "Doutorado" not in recorte.texto


def test_recorte_e_insensivel_a_acento_e_caixa():
    cv = (
        "Identificação\nNome X\n"
        "ATUACAO PROFISSIONAL\n"
        "Empresa Y, Diretor de pesquisa\n"
        "Áreas de atuação\nQuímica\n"
    )
    recorte = extrair_secao(cv, None, "atuacao")

    assert recorte is not None
    assert "Diretor de pesquisa" in recorte.texto


def test_secao_ausente_retorna_none():
    cv = "Identificação\nNome X\nFormação acadêmica/titulação\nGraduação em Física\n"
    assert extrair_secao(cv, None, "atuacao") is None


def test_extrair_secao_cai_para_html_quando_pdf_nao_tem():
    pdf_sem_secao = "Identificação\nNome X\nFormação acadêmica/titulação\nGraduação\n"
    html_com_secao = (
        "Atuação Profissional\nUniversidade Z, Professor\nÁreas de atuação\nFísica\n"
    )
    recorte = extrair_secao(pdf_sem_secao, html_com_secao, "atuacao")

    assert recorte is not None
    assert recorte.fonte == "html"
    assert "Universidade Z, Professor" in recorte.texto
    assert recorte.texto_pdf == ""


def test_extrair_secao_invalida_retorna_none():
    assert extrair_secao(CV_TEXTO, None, "inexistente") is None


def test_segmentar_encontra_secoes_principais():
    secoes = segmentar(CV_TEXTO)

    assert set(secoes).issuperset(
        {"resumo", "formacao", "atuacao", "producao", "orientacoes", "projetos"}
    )


def test_label_da_secao():
    assert label_da_secao("atuacao") == "Atuação profissional"
    assert label_da_secao(None) is None
    assert label_da_secao("inexistente") is None


def test_secoes_validas_expostas():
    assert "atuacao" in SECOES_VALIDAS
    assert "completo" not in SECOES_VALIDAS
