from typing import Optional

from pydantic import BaseModel


class ScrapeRequest(BaseModel):
    nome: str
    href: Optional[str] = None
