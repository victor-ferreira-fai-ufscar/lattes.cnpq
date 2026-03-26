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

`_extrair_contexto_pagina()` realiza:

- captura de `page.content()` (HTML completo)
- captura de texto visível em `body.inner_text()` (timeout 10000ms)
- validação de suficiência:
  - HTML <200 chars e texto <100 chars -> `ExtracaoCurriculoError`
- monta saída de contexto com:
  - `URL_FINAL`, `TITULO_PAGINA`, `TEXTO_VISIVEL_EXTRAIDO`, `HTML_COMPLETO`

## 7. Geração de resumo IA

`gerar_resumo_ia()` faz roteamento

- `google gemini` -> `_gerar_resumo_gemini()`
- `openai` -> `_gerar_resumo_openai()`

### Prompt padrão (`_get_prompt()`)

- extrai campos esperados:
  - `graduacao`, `mestrado`, `doutorado`, `pos_doutorado`, `vinculo_institucional`, `resumo`
- controla tamanho máximo de entrada:clipping para 40k chars.

## 8. Adaptação para FastAPI

No `backend/src/api/routes.py`, o fluxo é:

1. chama `scrape_lattes(nome, log_callback=...)`
2. grava raw text em `output/raw`
3. chama `gerar_resumo_ia(...)`
4. gera DOCX em `output/structured`
5. retorna estrutura de JSON e caminho do arquivo.

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
