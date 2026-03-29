import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega o .env do backend antes de qualquer importação do src/
load_dotenv(Path(__file__).parent.parent / ".env")
