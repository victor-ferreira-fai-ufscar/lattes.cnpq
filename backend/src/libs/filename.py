import re
import unicodedata
from datetime import date


def slugify_nome(nome: str) -> str:
    sem_acento = unicodedata.normalize("NFD", nome.strip().lower())
    sem_acento = sem_acento.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")
    return slug or "docente"


def build_curriculo_filename(nome: str, ultima_atualizacao: date) -> str:
    data = ultima_atualizacao.strftime("%Y-%m-%d")
    return f"{slugify_nome(nome)}-{data}.pdf"
