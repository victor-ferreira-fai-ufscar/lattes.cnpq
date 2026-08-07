from typing import Literal, Optional

from pydantic import BaseModel


OutputFormat = Literal["pdf", "docx", "json", "html", "csv", "all"]


class ScrapeRequest(BaseModel):
    nome: str
    href: Optional[str] = None
    output_format: OutputFormat = "docx"
    # Opt-in: gerar o resumo por IA antes de montar os artefatos, para que
    # HTML/DOCX/JSON saiam com o Resumo Executivo embutido (o mesmo que o lote
    # faz com `gerar_resumo`). Custa a chamada ao modelo dentro da request, por
    # isso fica desligado por padrão.
    gerar_resumo: bool = False
