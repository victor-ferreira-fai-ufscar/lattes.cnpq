from typing import Literal, Optional

from pydantic import BaseModel


OutputFormat = Literal["pdf", "docx", "json", "html", "csv", "all"]


class ScrapeRequest(BaseModel):
    nome: str
    href: Optional[str] = None
    output_format: OutputFormat = "docx"
