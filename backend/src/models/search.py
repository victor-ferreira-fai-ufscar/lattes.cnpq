from pydantic import BaseModel


class SearchRequest(BaseModel):
    nome: str
    limit: int = 20
