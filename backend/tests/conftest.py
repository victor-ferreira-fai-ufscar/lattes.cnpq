import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Carrega o .env do backend antes de qualquer importação do src/
load_dotenv(Path(__file__).parent.parent / ".env")


@pytest.fixture(autouse=True)
def _desliga_perfil_externo_por_padrao(monkeypatch):
    """Impede que a suíte faça chamadas reais ao OpenAlex e ao Google News.

    O enriquecimento externo é disparado automaticamente pelos routers, então
    sem isto qualquer teste de /scrape ou /scrape/batch sairia para a internet —
    lento e sujeito a falha fora do controle do teste. Quem precisa do
    comportamento (tests/test_perfil_externo.py) religa a flag explicitamente.
    """
    monkeypatch.setenv("PERFIL_EXTERNO_ENABLED", "false")
