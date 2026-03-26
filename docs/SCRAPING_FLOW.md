# Fluxo de Scraping do Lattes

Este documento descreve o fluxo de automação do scraper em `backend/src/core/scraper.py`.

## 1. Página inicial de busca

A automação inicia em:

- `https://lattes.cnpq.br/` (interface padrão) -> rolando -> botão "Buscar currículo" (opcional)
- diretamente em `https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar` (ponto raiz usado atualmente)

## 2. Preenchimento da busca

- Campo `input[name='textoBusca']` recebe o nome do docente (ex: `Neocles`).
- Clicar em `#botaoBuscaFiltros` para submeter.

## 3. Resultados da busca

- Identifica elementos `.resultado a`.
- Se nenhum resultado:
  - busca mensagens de "nenhum currículo encontrado" para lançar `DocenteNaoEncontradoError`.
- Se há resultados:
  - procura correspondência exata por texto (nome completo).
  - caso não exista, seleciona o primeiro resultado.

## 4. Abrir Currículo

- Clica no item selecionado.
- Procura o botão de abertura do currículo com seletores:
  - `#idbtnabrircurriculo`
  - `input[value='Abrir Currículo']`
  - `a:has-text('Abrir Currículo')`
  - e variações sem acento.
- Se não encontra o botão lança `CurriculoNaoEncontradoError`.

## 5. Página do CV Lattes

- Na ação de abrir currículo, espera nova aba/aba atual.
- Aguarda carregamento da página com `page_cv.wait_for_load_state("domcontentloaded")`.
- Espera 2s adicionais para estabilizar.

## 6. Extração de conteúdo

O scraper realiza:

- captura de `page.content()` (HTML completo)
- captura de texto visível em `body.inner_text()` (timeout 10000ms)
- validação de suficiência:
  - HTML <200 chars e texto <100 chars -> `ExtracaoCurriculoError`
- monta saída de contexto com:
  - `url_cv`, `titulo_pagina`, `texto_visivel_extraido`, `html_completo`

## 7. Persistência do HTML bruto

No endpoint `/scrape`:

- remove `html_completo` da resposta JSON
- salva HTML em `backend/output/raw/<nome>-<timestamp>.html`
- retorna:
  - `arquivo_html`
  - `download_html_url` (ex: `/download/raw/neocles-20260326-123456.html`)

## 8. Adaptação para FastAPI

No `backend/src/api/main.py`, o fluxo é:

1. chama `scrape_lattes(nome)`
2. grava o HTML bruto em `output/raw`
3. retorna JSON com campos extraídos + caminho de download do HTML
4. disponibiliza arquivo no endpoint `GET /download/raw/{filename}`

---

## Notas de estabilidade

- O token `tokenCaptchar` aparece na URL final do Lattes. O scraper ignora e capturamos o HTML completo.
- Mantenha `HEADLESS=true` no `.env` para ambiente servidor.
- Recomenda-se: `PLAYWRIGHT_BROWSERS_PATH=0` ou instalar browsers via `playwright install --with-deps chromium`.

---

## Checklist de melhorias futuras

- [ ] Reintentar automaticamente se ocorrer timeout ao abrir resultados
- [ ] Incluir cache local com hash do nome/timestamp
- [ ] Capturar `cookies` e `captcha` indiretos (robo de IP)
- [ ] Implementar testes automatizados na pasta `backend/tests`
