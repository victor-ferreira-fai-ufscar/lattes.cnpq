from fastapi import APIRouter, HTTPException

from ...core.scraper import buscar_lattes_candidatos
from ...models import SearchRequest

router = APIRouter()


@router.post("/search")
async def search(request: SearchRequest):
    nome = request.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do docente.")

    limit = max(1, min(request.limit, 50))

    try:
        candidatos = await buscar_lattes_candidatos(nome, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "nome_busca": nome,
        "total": len(candidatos),
        "candidatos": [
            {
                "nome": candidato.nome,
                "href": candidato.href,
            }
            for candidato in candidatos
        ],
    }
