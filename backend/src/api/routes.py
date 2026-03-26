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
from .schemas import (
    BatchScrapeRequest,
    ScrapeFullResponse,
    ScrapeRequest,
    ScrapeResponse,
)

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


def _parse_scrape_output(texto_bruto: str) -> dict:
    """Parse the output from scrape_lattes() to extract HTML, visible text, and URL."""
    result = {
        "url_final": None,
        "titulo_pagina": None,
        "texto_visivel": None,
        "html_completo": None
    }
    
    lines = texto_bruto.split("\n")
    current_section = None
    content_buffer = []
    
    for line in lines:
        if line.startswith("URL_FINAL:"):
            if current_section and content_buffer:
                result[current_section] = "\n".join(content_buffer).strip()
                content_buffer = []
            result["url_final"] = line.replace("URL_FINAL:", "").strip()
            current_section = None
        elif line.startswith("TITULO_PAGINA:"):
            if current_section and content_buffer:
                result[current_section] = "\n".join(content_buffer).strip()
                content_buffer = []
            result["titulo_pagina"] = line.replace("TITULO_PAGINA:", "").strip()
            current_section = None
        elif line.startswith("TEXTO_VISIVEL_EXTRAIDO:"):
            if current_section and content_buffer:
                result[current_section] = "\n".join(content_buffer).strip()
                content_buffer = []
            current_section = "texto_visivel"
        elif line.startswith("HTML_COMPLETO:"):
            if current_section and content_buffer:
                result[current_section] = "\n".join(content_buffer).strip()
                content_buffer = []
            current_section = "html_completo"
        elif current_section:
            content_buffer.append(line)
    
    # Capture last section
    if current_section and content_buffer:
        result[current_section] = "\n".join(content_buffer).strip()
    
    return result


@router.post("/scrape/full", response_model=ScrapeFullResponse)
async def scrape_full(request: ScrapeRequest):
    """
    Endpoint de teste completo - mostra o pipeline inteiro:
    HTML extraído + Resumo IA processado.
    Útil para debugging e validação da estrutura de dados.
    """
    try:
        logger.info(f"Iniciando scrape completo para: {request.nome}")
        
        # Step 1: Scrape raw Lattes page
        texto_bruto = await scrape_lattes(
            request.nome,
            log_callback=lambda msg: logger.info(msg),
            headless=request.headless,
        )
        
        # Step 2: Parse output to extract components
        parsed = _parse_scrape_output(texto_bruto)
        
        # Step 3: Generate AI summary from visible text
        resumo_ia = None
        if parsed.get("texto_visivel"):
            resumo_ia = gerar_resumo_ia(
                parsed["texto_visivel"],
                request.provedor,
                request.modelo,
                api_key=request.api_key,
                log_callback=lambda msg: logger.info(msg),
            )
        
        logger.info(f"Scrape completo finalizado para: {request.nome}")
        
        return ScrapeFullResponse(
            nome=request.nome,
            html_raw=parsed.get("html_completo"),
            texto_visivel=parsed.get("texto_visivel"),
            url_final=parsed.get("url_final"),
            resumo_ia=resumo_ia,
            timestamp=datetime.now().isoformat()
        )
        
    except DocenteNaoEncontradoError as exc:
        logger.warning(f"Docente não encontrado: {exc}")
        return ScrapeFullResponse(
            nome=request.nome,
            erro=str(exc),
            timestamp=datetime.now().isoformat()
        )
    except CurriculoNaoEncontradoError as exc:
        logger.warning(f"Currículo não encontrado: {exc}")
        return ScrapeFullResponse(
            nome=request.nome,
            erro=str(exc),
            timestamp=datetime.now().isoformat()
        )
    except ExtracaoCurriculoError as exc:
        logger.warning(f"Erro na extração do currículo: {exc}")
        return ScrapeFullResponse(
            nome=request.nome,
            erro=str(exc),
            timestamp=datetime.now().isoformat()
        )
    except Exception as exc:
        logger.error(f"Erro inesperado em scrape_full: {exc}")
        return ScrapeFullResponse(
            nome=request.nome,
            erro=f"Falha inesperada: {exc}",
            timestamp=datetime.now().isoformat()
        )


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
    )    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )