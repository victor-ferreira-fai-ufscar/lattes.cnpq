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


class ScrapeFullResponse(BaseModel):
    """Endpoint completo de teste - retorna HTML bruto + resumo IA."""

    nome: str
    html_raw: Optional[str] = None  # HTML completo extraído
    texto_visivel: Optional[str] = None  # Texto visível do CV
    url_final: Optional[str] = None  # URL final após navegação
    resumo_ia: Optional[dict] = None  # Resumo processado pela IA
    erro: Optional[str] = None
    timestamp: str = ""  # ISO format
