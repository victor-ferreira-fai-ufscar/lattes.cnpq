# scripts/batch_scrape.py

Script para fazer scraping em lote de currículos Lattes a partir de um arquivo CSV com nomes de docentes. Gera um PDF por docente e envia para o Supabase Storage.

## Pré-requisitos

Executar a partir do diretório `backend/`:

```bash
cd backend
uv sync
uv run playwright install chromium  # apenas na primeira vez
```

Variáveis obrigatórias no `.env`:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
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

O script remove duplicatas no próprio CSV (mantendo a ordem).

### Nomes de arquivo

O nome segue o padrão `{slug-do-nome}-{YYYY-MM-DD}.pdf`, onde a data é a "última atualização do currículo" extraída do Lattes.

Acentos são removidos automaticamente para compatibilidade:

| Nome                                 | Arquivo gerado                                           |
| ------------------------------------ | -------------------------------------------------------- |
| `Amélia Arcângela Teixeira Trindade` | `amelia-arcangela-teixeira-trindade-2020-09-11.pdf`     |
| `Ângela Merice de Oliveira Leal`     | `angela-merice-de-oliveira-leal-2019-03-02.pdf`         |

### Cache no Storage

O upload usa `upsert=true`, então execuções repetidas atualizam o mesmo objeto no bucket quando o nome do arquivo coincide.

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
[ 2/10] Aline Guerra Aquilante                             ✓  699.5 KB  →  aline-guerra-aquilante-2020-09-11.pdf (raw/aline-guerra-aquilante-2020-09-11.pdf)
[ 3/10] Amélia Arcângela Teixeira Trindade                 ✓  702.1 KB  →  amelia-arcangela-teixeira-trindade-2021-04-15.pdf (raw/amelia-arcangela-teixeira-trindade-2021-04-15.pdf)
...

==========================================================================================
                                   RESUMO FINAL
==========================================================================================

✅ Sucesso:  8/10
   • Aline Guerra Aquilante                                699.5 KB (2020-09-11)
   ...

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

## Saída de arquivos

Os PDFs ficam no bucket configurado (`SUPABASE_STORAGE_BUCKET`) e pasta (`SUPABASE_STORAGE_FOLDER`).
