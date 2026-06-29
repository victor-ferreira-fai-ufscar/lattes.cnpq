from typing import Optional

from pydantic import BaseModel


class SummarizeRequest(BaseModel):
    nome: str
    api_key: Optional[str] = None
    modelo: str = "gemma4:12b"
    provedor: str = "ollama"
    # Seção do currículo a resumir (ex.: "atuacao"). None/ausente ou um valor
    # desconhecido significam currículo completo (comportamento padrão).
    secao: Optional[str] = None


class ModelsRequest(BaseModel):
    provedor: str = "ollama"
    api_key: Optional[str] = None
