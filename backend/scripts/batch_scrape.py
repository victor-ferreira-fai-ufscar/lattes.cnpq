#!/usr/bin/env python3
"""
Script de batch scraping de currículos Lattes a partir de CSV.

Uso (a partir do diretório backend/):
    uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv --limit 5
    uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv --skip 0 --limit 10
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Adiciona backend/ ao path para importar src.*
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.api.main import _build_curriculo_filename
from src.core.scraper import scrape_lattes
from src.core.storage import upload_curriculo_pdf


async def processar_lote(
    csv_path: str,
    skip: int = 0,
    limit: Optional[int] = None,
    parar_em_erro: bool = False,
) -> dict:
    """
    Processa um lote de nomes a partir de um CSV.

    Args:
        csv_path: Caminho para o arquivo CSV com nomes
        skip: Número de linhas para pular
        limit: Número máximo de nomes para processar (None = todos)
        parar_em_erro: Se True, para no primeiro erro
    Returns:
        Dicionário com estatísticas: {sucesso, erro, total_kb, tempo_total}
    """
    csv_file = Path(csv_path)
    if not csv_file.exists():
        raise FileNotFoundError(f"Arquivo CSV não encontrado: {csv_path}")

    # Ler CSV e remover linhas vazias
    with open(csv_file, "r", encoding="utf-8") as f:
        todas_linhas = [linha.strip() for linha in f.readlines() if linha.strip()]

    # Aplicar skip e limit
    nomes_raw = todas_linhas[skip:]
    if limit:
        nomes_raw = nomes_raw[:limit]

    # Remover duplicatas do CSV (mantendo a ordem)
    vistos: set[str] = set()
    nomes: list[str] = []
    for n in nomes_raw:
        chave = n.lower().strip()
        if chave not in vistos:
            vistos.add(chave)
            nomes.append(n)

    duplicatas_csv = len(nomes_raw) - len(nomes)

    inicio = datetime.now()
    resultados: dict = {
        "sucesso": [],
        "erro": [],
        "total_kb": 0,
        "tempo_total": None,
    }

    print("=" * 90)
    print(" " * 30 + "BATCH SCRAPING — LATTES")
    print("=" * 90)
    print(f"\n📋 Configuração:")
    print(f"   CSV: {csv_file.name}")
    print(f"   Total de nomes no arquivo: {len(todas_linhas)}")
    print(f"   Selecionados (skip={skip}, limit={limit}): {len(nomes_raw)}")
    if duplicatas_csv:
        print(f"   Duplicatas removidas do CSV: {duplicatas_csv}")
    print(f"   Únicos a processar: {len(nomes)}")
    print("   Upload de PDFs: Supabase Storage")
    print(f"   Parar em erro: {'Sim' if parar_em_erro else 'Não'}")
    print(f"\n{'─' * 90}\n")

    for idx, nome in enumerate(nomes, 1):
        print(f"[{idx:2d}/{len(nomes)}] {nome[:50]:50s} ", end="", flush=True)

        try:
            scrape_result = await scrape_lattes(nome)
            filename = _build_curriculo_filename(nome, scrape_result.ultima_atualizacao)
            upload_result = upload_curriculo_pdf(filename, scrape_result.pdf_bytes)
            tamanho_kb = len(scrape_result.pdf_bytes) / 1024

            resultados["sucesso"].append(
                {
                    "nome": nome,
                    "arquivo": filename,
                    "storage_path": upload_result.object_path,
                    "download_url": upload_result.download_url,
                    "ultima_atualizacao": scrape_result.ultima_atualizacao.isoformat(),
                    "tamanho_kb": tamanho_kb,
                }
            )
            resultados["total_kb"] += tamanho_kb

            print(
                f"✓ {tamanho_kb:6.1f} KB  →  {filename} "
                f"({upload_result.object_path})"
            )

        except ValueError as e:
            erro_msg = str(e)
            resultados["erro"].append({"nome": nome, "erro": erro_msg})
            print(f"✗ {erro_msg}")

            if parar_em_erro:
                print(f"\n⚠️  Parando (--parar-em-erro)")
                break

        except Exception as e:
            erro_msg = f"{type(e).__name__}: {e}"
            resultados["erro"].append({"nome": nome, "erro": erro_msg})
            print(f"✗ {erro_msg}")

            if parar_em_erro:
                print(f"\n⚠️  Parando (--parar-em-erro)")
                break

        await asyncio.sleep(0.5)  # Delay gentil entre requests

    tempo_total = (datetime.now() - inicio).total_seconds()
    resultados["tempo_total"] = tempo_total

    # Resumo
    print("\n" + "=" * 90)
    print(" " * 35 + "RESUMO FINAL")
    print("=" * 90)

    print(f"\n✅ Sucesso:  {len(resultados['sucesso'])}/{len(nomes)}")
    for item in resultados["sucesso"]:
        print(
            f"   • {item['nome'][:50]:50s} {item['tamanho_kb']:6.1f} KB "
            f"({item['ultima_atualizacao']})"
        )

    if resultados["erro"]:
        print(f"\n❌ Erros:  {len(resultados['erro'])}/{len(nomes)}")
        for item in resultados["erro"]:
            print(f"   • {item['nome'][:50]:50s} {item['erro'][:40]}")

    total_processados = len(resultados["sucesso"]) + len(resultados["erro"])
    if total_processados > 0:
        print(f"\n📊 Estatísticas:")
        print(f"   Total gerado: {resultados['total_kb']:.1f} KB")
        print(
            f"   Tempo total: {tempo_total:.1f}s "
            f"({tempo_total / total_processados:.1f}s por nome novo)"
        )

    print("\n" + "=" * 90 + "\n")

    return resultados


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Batch scraping de currículos Lattes a partir de CSV"
    )
    parser.add_argument("csv", help="Caminho do arquivo CSV com nomes")
    parser.add_argument("--skip", type=int, default=0, help="Linhas a pular no início")
    parser.add_argument(
        "--limit", type=int, default=None, help="Máximo de nomes a processar"
    )
    parser.add_argument(
        "--parar-em-erro", action="store_true", help="Parar no primeiro erro"
    )

    args = parser.parse_args()

    try:
        resultados = await processar_lote(
            csv_path=args.csv,
            skip=args.skip,
            limit=args.limit,
            parar_em_erro=args.parar_em_erro,
        )
        sys.exit(1 if resultados["erro"] else 0)

    except FileNotFoundError as e:
        print(f"\n❌ {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"\n❌ Erro fatal: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
