import logging
import os
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from ..core.document_maker import create_lattes_docx
from ..core.scraper import (
    CurriculoNaoEncontradoError,
    DocenteNaoEncontradoError,
    ExtracaoCurriculoError,
    gerar_resumo_ia,
    scrape_lattes,
)
from .schemas import BatchScrapeRequest, ScrapeRequest, ScrapeResponse

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Create output directories
OUTPUT_RAW = "output/raw"
OUTPUT_DOCX = "output/structured"
os.makedirs(OUTPUT_RAW, exist_ok=True)
os.makedirs(OUTPUT_DOCX, exist_ok=True)

@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_individual(request: ScrapeRequest):
    """Processa um único nome de docente."""
    try:
        logger.info(f"Iniciando processamento de: {request.nome}")

        # Scrape the Lattes CV
        texto_bruto = await scrape_lattes(
            request.nome,
            log_callback=lambda msg: logger.info(msg),
            headless=request.headless,
        )

        # Save raw text
        raw_path = os.path.join(OUTPUT_RAW, f"{request.nome.replace(' ', '_')}_raw.txt")
        with open(raw_path, "w", encoding="utf-8") as file:
            file.write(texto_bruto)

        # Generate AI summary
        dados = gerar_resumo_ia(
            texto_bruto,
            request.provedor,
            request.modelo,
            api_key=request.api_key,
            log_callback=lambda msg: logger.info(msg),
        )

        if not dados:
            raise HTTPException(status_code=500, detail="A IA retornou um resultado vazio.")

        if isinstance(dados, dict) and "erro" in dados:
            raise HTTPException(status_code=500, detail=dados["erro"])

        # Generate DOCX
        docx_path = create_lattes_docx(request.nome, dados, OUTPUT_DOCX)

        logger.info(f"Processamento concluído para: {request.nome}")
        return ScrapeResponse(
            nome=request.nome,
            dados=dados,
            docx_path=docx_path
        )

    except DocenteNaoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except CurriculoNaoEncontradoError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ExtracaoCurriculoError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.error(f"Erro inesperado: {exc}")
        raise HTTPException(status_code=500, detail=f"Falha inesperada: {exc}")

@router.post("/scrape/batch")
async def scrape_batch(request: BatchScrapeRequest, background_tasks: BackgroundTasks):
    """Processa uma lista de nomes em lote."""
    # For batch processing, we'll run in background and return job ID
    # For simplicity, process synchronously for now
    results = []
    for nome in request.nomes:
        try:
            scrape_req = ScrapeRequest(
                nome=nome,
                provedor=request.provedor,
                modelo=request.modelo,
                api_key=request.api_key,
                headless=request.headless
            )
            result = await scrape_individual(scrape_req)
            results.append(result)
        except Exception as e:
            results.append(ScrapeResponse(
                nome=nome,
                erro=str(e)
            ))

    return {"results": results}

@router.get("/download/{filename}")
async def download_file(filename: str):
    """Download generated DOCX files."""
    file_path = os.path.join(OUTPUT_DOCX, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )    )