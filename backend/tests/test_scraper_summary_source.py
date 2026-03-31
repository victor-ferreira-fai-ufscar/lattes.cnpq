from src.core.scraper import _pdf_parece_completo


def test_pdf_parece_completo_quando_tem_texto_robusto_e_sinais_do_curriculo():
    texto_pdf = "\n".join(
        [
            "Última atualização do currículo em 11/09/2020",
            "Resumo informado pelo autor",
            "Formação acadêmica/titulação",
            "Atuação profissional",
            "Produção bibliográfica",
        ]
        + ["Detalhes adicionais do currículo."] * 120
    )
    texto_html = "Resumo informado pelo autor\nFormação acadêmica/titulação\nAtuação profissional"

    assert _pdf_parece_completo(texto_pdf, texto_html) is True


def test_pdf_parece_incompleto_quando_extracao_tem_pouco_texto():
    texto_pdf = "Resumo informado pelo autor\nFormação acadêmica/titulação"
    texto_html = "\n".join(
        [
            "Última atualização do currículo em 11/09/2020",
            "Resumo informado pelo autor",
            "Formação acadêmica/titulação",
            "Atuação profissional",
            "Produção bibliográfica",
        ]
        + ["Conteúdo do currículo em HTML."] * 150
    )

    assert _pdf_parece_completo(texto_pdf, texto_html) is False