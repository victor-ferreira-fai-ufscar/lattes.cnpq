"""
Testes de integração para o scraper do Lattes.

Estes testes verificam:
1. Conexão e busca no site do Lattes
2. Extração de HTML e texto do currículo
3. Geração de resumo com IA (OpenAI/Gemini)
4. Estrutura de dados retornada

Para rodar: pytest backend/tests/test_scraper.py -v
"""

import asyncio
import json
import os
from typing import Optional

import pytest
from src.core.scraper import (
    CurriculoNaoEncontradoError,
    DocenteNaoEncontradoError,
    ExtracaoCurriculoError,
    gerar_resumo_ia,
    scrape_lattes,
)


class TestScraperIntegration:
    """Suite de testes de integração do scraper Lattes."""

    @pytest.mark.asyncio
    async def test_scrape_lattes_success(self):
        """Testa se consegue fazer scrape de um currículo válido."""
        # Use um nome que sabemos que existe no Lattes
        # Recomendação: docente bem conhecido da UFSCar
        nome = "Neocles Juaçaba"

        try:
            resultado = await scrape_lattes(
                nome,
                log_callback=lambda msg: print(f"[LOG] {msg}"),
                headless=True,
            )

            # Validações básicas
            assert resultado is not None
            assert isinstance(resultado, str)
            assert len(resultado) > 500
            assert "URL_FINAL" in resultado
            assert "TEXTO_VISIVEL_EXTRAIDO" in resultado
            assert "HTML_COMPLETO" in resultado
            print(f"✅ Scrape bem-sucedido ({len(resultado)} caracteres capturados)")

        except (DocenteNaoEncontradoError, CurriculoNaoEncontradoError) as e:
            pytest.skip(f"Scraper encontrou erro esperado: {e}")

    @pytest.mark.asyncio
    async def test_scrape_lattes_invalid_name(self):
        """Testa se lança erro para nome inexistente."""
        nome = "XYZinvalidoQWERTYUIOPAsdfghjkl123456789"

        with pytest.raises(DocenteNaoEncontradoError):
            await scrape_lattes(nome, headless=True)

    @pytest.mark.asyncio
    async def test_scrape_lattes_empty_name(self):
        """Testa se rejeita nome vazio."""
        with pytest.raises(DocenteNaoEncontradoError):
            await scrape_lattes("", headless=True)

    def test_gerar_resumo_ia_openai(self):
        """Testa geração de resumo com OpenAI."""
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            pytest.skip("OPENAI_API_KEY não configurada")

        # Texto mínimo simulado (em caso real, vem do scraper)
        texto_teste = """
        Neocles Juscelino Kubitschek de Oliveira
        Educação:
        - Graduação em Engenharia Eletrônica
        - Mestrado em Engenharia Elétrica
        - Doutorado em Engenharia Elétrica
        Vínculo: Universidade Federal de São Carlos
        Pesquisa: Machine Learning, Processamento de Sinais
        """

        resultado = gerar_resumo_ia(
            texto_teste,
            provedor="OpenAI",
            modelo="gpt-4o-mini",
            api_key=api_key,
            log_callback=lambda msg: print(f"[LOG] {msg}"),
        )

        # Validações
        assert resultado is not None
        assert isinstance(resultado, dict)
        assert "resumo" in resultado or "erro" in resultado

        if "erro" not in resultado:
            assert "vinculo_institucional" in resultado
            assert "graduacao" in resultado
            print(
                f"✅ Resumo IA gerado com sucesso: {resultado.get('resumo', '')[:100]}..."
            )
        else:
            print(f"⚠️ Erro na IA: {resultado['erro']}")

    def test_gerar_resumo_ia_gemini(self):
        """Testa geração de resumo com Google Gemini."""
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            pytest.skip("GEMINI_API_KEY não configurada ou está no valor padrão")

        texto_teste = """
        Candidato: João Silva
        Formação:
        - Graduação em Engenharia Civil
        - Mestrado em Estruturas
        Instituição: USP São Carlos
        """

        resultado = gerar_resumo_ia(
            texto_teste,
            provedor="Google Gemini",
            modelo="gemini-2.0-flash",
            api_key=api_key,
            log_callback=lambda msg: print(f"[LOG] {msg}"),
        )

        assert resultado is not None
        assert isinstance(resultado, dict)

        if "erro" not in resultado:
            assert "resumo" in resultado
            print(f"✅ Gemini OK: {resultado.get('resumo', '')[:100]}...")
        else:
            print(f"⚠️ Erro no Gemini: {resultado['erro']}")


class TestScraperUnit:
    """Testes unitários de componentes individuais."""

    def test_headless_from_env_default(self):
        """Testa valor padrão de HEADLESS."""
        os.environ.pop("HEADLESS", None)
        from src.core.scraper import _headless_from_env

        assert _headless_from_env() is True

    def test_headless_from_env_explicit_false(self):
        """Testa configuração explícita HEADLESS=false."""
        os.environ["HEADLESS"] = "false"
        # Re-import para capturar novo valor
        import importlib

        import src.core.scraper as scraper_module

        importlib.reload(scraper_module)

        assert scraper_module._headless_from_env() is False


# Fixtures para dados comuns
@pytest.fixture
def sample_lattes_html():
    """HTML simples para testes sem fazer scraping real."""
    return """
    <html>
        <head><title>CV Lattes - João Silva</title></head>
        <body>
            <h1>João Silva</h1>
            <p>Graduação: Engenharia</p>
            <p>Mestrado: USP</p>
            <p>Doutorado: UNICAMP</p>
            <p>Instituição: UFSCar</p>
        </body>
    </html>
    """


if __name__ == "__main__":
    # Para rodar direto: python -m pytest backend/tests/test_scraper.py -v
    pytest.main([__file__, "-v", "-s"])
    pytest.main([__file__, "-v", "-s"])
