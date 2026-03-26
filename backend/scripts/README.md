# scripts/batch_scrape.py

Script para fazer scraping em lote de currículos Lattes a partir de um arquivo CSV com nomes de docentes. Gera um PDF por docente em `backend/output/raw/`.

## Pré-requisitos

Executar a partir do diretório `backend/`:

```bash
cd backend
uv sync
uv run playwright install chromium  # apenas na primeira vez
```

## Uso

```bash
# Testar com 3 nomes
uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv --limit 3

# Processar 10 nomes a partir do 6º
uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv --skip 5 --limit 10

# Processar todos
uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv

# Parar no primeiro erro
uv run python scripts/batch_scrape.py ../docs/csv/50-nomes-docentes.csv --limit 5 --parar-em-erro
```

## Opções

| Opção             | Descrição                   | Padrão          |
| ----------------- | --------------------------- | --------------- |
| `csv`             | Caminho do arquivo CSV      | **obrigatório** |
| `--limit N`       | Máximo de nomes a processar | todos           |
| `--skip N`        | Pular N primeiras linhas    | `0`             |
| `--parar-em-erro` | Para ao primeiro erro       | `False`         |

## Comportamento

### Deduplicação automática

O script nunca baixa o mesmo profissional duas vezes:

- **Duplicatas no CSV**: nomes repetidos no mesmo arquivo são ignorados automaticamente.
- **PDFs já existentes**: se `output/raw/` já contiver um PDF com o mesmo slug do nome (ex: `aline-guerra-aquilante-*.pdf`), a linha é pulada com o status `↩ já existe`.

Isso é seguro para rodar novamente após uma interrupção — só processa os nomes que ainda faltam.

### Nomes de arquivo

Acentos são removidos automaticamente para compatibilidade:

| Nome                                 | Arquivo gerado                                           |
| ------------------------------------ | -------------------------------------------------------- |
| `Amélia Arcângela Teixeira Trindade` | `amelia-arcangela-teixeira-trindade-20260326-123456.pdf` |
| `Ângela Merice de Oliveira Leal`     | `angela-merice-de-oliveira-leal-20260326-123456.pdf`     |

### Taxa de sucesso esperada

Alguns nomes do CSV podem não estar no Lattes da forma exata como estão escritos (variações, aposentadorias, etc.). Taxa típica: **80–90%** de sucesso.

### Timing estimado

| Quantidade | Tempo estimado |
| ---------- | -------------- |
| 3 nomes    | ~18s           |
| 10 nomes   | ~85s           |
| 50 nomes   | ~7 minutos     |

## Saída

```bash
==========================================================================================
                              BATCH SCRAPING — LATTES
==========================================================================================

📋 Configuração:
   CSV: 50-nomes-docentes.csv
   Total de nomes no arquivo: 50
   Selecionados (skip=0, limit=10): 10
   Únicos a processar: 10
   Parar em erro: Não

──────────────────────────────────────────────────────────────────────────────────────────

[ 1/10] Aline Barreto de Almeida Nordi                    ✗ Nenhum resultado encontrado
[ 2/10] Aline Guerra Aquilante                             ✓  699.5 KB  →  aline-guerra-aquilante-20260326-183650.pdf
[ 3/10] Amélia Arcângela Teixeira Trindade                 ↩ já existe: amelia-arcangela-teixeira-trindade-20260326-183656.pdf
...

==========================================================================================
                                   RESUMO FINAL
==========================================================================================

✅ Sucesso:  8/10
   • Aline Guerra Aquilante                                699.5 KB
   ...

↩  Pulados (já existiam):  1
   • Amélia Arcângela Teixeira Trindade                    amelia-arcangela-...pdf

❌ Erros:  1/10
   • Aline Barreto de Almeida Nordi                        Nenhum resultado encontrado

📊 Estatísticas:
   Total gerado: 3456.4 KB
   Tempo total: 85.0s (9.4s por nome novo)

==========================================================================================
```

## Exit codes

| Código | Significado                            |
| ------ | -------------------------------------- |
| `0`    | Todos os nomes processados com sucesso |
| `1`    | Parcial — houve pelo menos um erro     |
| `2`    | Erro fatal (CSV não encontrado, etc.)  |

## Formato do CSV

Um nome por linha, UTF-8:

```bash
Aline Barreto de Almeida Nordi
Aline Guerra Aquilante
Amélia Arcângela Teixeira Trindade
...
```

## PDFs gerados

Salvos em `backend/output/raw/`:

```bash
aline-guerra-aquilante-20260326-183650.pdf
amelia-arcangela-teixeira-trindade-20260326-183656.pdf
andrea-aparecida-contini-20260326-183701.pdf
...
```
