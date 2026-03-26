from typing import List, Optional

from pydantic import BaseModel


class ScrapeRequest(BaseModel):
    nome: str
    provedor: str
    modelo: str
    api_key: Optional[str] = None
    headless: bool = True


class BatchScrapeRequest(BaseModel):
    nomes: List[str]
    provedor: str
    modelo: str
    api_key: Optional[str] = None
    headless: bool = True


class ScrapeResponse(BaseModel):
    nome: str
    dados: Optional[dict] = None
    docx_path: Optional[str] = None
    erro: Optional[str] = None
