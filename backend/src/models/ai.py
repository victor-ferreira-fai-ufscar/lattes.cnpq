from typing import Optional

from pydantic import BaseModel


class SummarizeRequest(BaseModel):
    nome: str
    api_key: Optional[str] = None
    modelo: str = "gpt-4o-mini"
    provedor: str = "openai"


class ModelsRequest(BaseModel):
    provedor: str = "openai"
    api_key: Optional[str] = None
