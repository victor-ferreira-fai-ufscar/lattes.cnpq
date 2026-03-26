# Fluxo de Scraping do Lattes — PDF

Este documento descreve o fluxo automatizado em `backend/src/core/scraper.py` que captura PDFs dos currículos Lattes.

## 1. Página inicial de busca

A automação inicia em:

- `https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar` (ponto de entrada)

## 2. Preenchimento da busca

- Campo `input[name='textoBusca']` recebe o nome do docente (ex: `Neocles`)
- Aguarda `window.grecaptcha` estar pronto (reCAPTCHA do site)
- Clica em `#botaoBuscaFiltros` para submeter

## 3. Resultados da busca

- Identifica elementos `.resultado a`
- Se nenhum resultado: lança `ValueError("Nenhum resultado encontrado...")`
- Se há resultados:
  - Busca correspondência exata por nome
  - Se não encontra, seleciona o primeiro resultado

## 4. Abrir Currículo — Modal/Página Final

- Clica no item selecionado
- Procura botão de abertura com seletores:
  - `#idbtnabrircurriculo`
  - `input[value='Abrir Currículo']`
  - `a:has-text('Abrir Currículo')`
  - e variações sem acento

- Se encontra: tenta abrir em nova aba/popup
  - Aguarda `expect_page()` com timeout de 7s
  - Valida se a nova página é o CV final (verificando marcadores de conteúdo)
  - Se popup não pode ser capturado: tenta fallback em ação JS
  
- Se não encontra: verifica se a página atual já é o CV final
  - Valida com marcadores como:
    - "Endereço para acessar este CV"
    - "Formação acadêmica/titulação"
    - "Última atualização do currículo"

## 5. Página do CV Lattes — Validação

- Valida que a página final contém marcadores de CV (não é página de resultados)
- Aguarda `wait_for_load_state("domcontentloaded")`

## 6. Geração do PDF

O scraper utiliza a funcionalidade nativa do Playwright:

```python
pdf_bytes = await cv_page.pdf(format="A4")
```

- Formato: A4
- Qualidade: renderizada pelo Chromium (mesma qualidade visual da página)
- Retorna: bytes do PDF prontos para salva

## 7. Persistência e Download

No endpoint `POST /scrape`:

- Salva PDF em `backend/output/raw/{nome}-{timestamp}.pdf`
- Retorna JSON com:
  - `nome`: nome do docente
  - `arquivo_pdf`: nome do arquivo gerado
  - `download_pdf_url`: URL para download via `GET /download/raw/{arquivo_pdf}`

No endpoint `GET /download/raw/{filename}`:

- Valida nome do arquivo (sem `../`, sem travessias)
- Retorna o PDF com `Content-Type: application/pdf`
- Headers de download automático

## 8. Tratamento de Erros

- `ValueError`: Convertido a `HTTPException(404)` no FastAPI
  - "Nenhum resultado encontrado para o nome informado."
  - "Não foi possível abrir a página final do currículo Lattes."
  - "Não foi possível acessar a busca do Lattes no momento." (timeout)

## 9. Retry Logic

- Inicial `goto()` ao Lattes: 3 tentativas com 45s timeout cada
  - Aguarda 1.2s entre tentativas (para instabilidade da rede)
  - Necessário: CNPq tem variabilidade de resposta

## Fluxo Resumido

```
Usuario solicita: POST /scrape { "nome": "Neocles" }
                     ↓
        Playwright abre Chromium
                     ↓
        Navega para busca.cnpq.br
                     ↓
        Preenche campo textoBusca
                     ↓
        Clica botão "Buscar"
                     ↓
        Identifica e clica resultado do nome
                     ↓
        Clica "Abrir Currículo" (modal/popup)
                     ↓
        Valida que a página aberta é o CV final
                     ↓
        page.pdf(format="A4") → gera PDF
                     ↓
        Salva em output/raw/{nome}-{timestamp}.pdf
                     ↓
        Retorna URL de download ao usuário
```

## Exemplos

### Request

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"nome": "Neocles"}'
```

### Response

```json
{
  "nome": "Neocles",
  "arquivo_pdf": "neocles-20260326-182953.pdf",
  "download_pdf_url": "/download/raw/neocles-20260326-182953.pdf"
}
```

### Download do PDF

```bash
curl http://localhost:8000/download/raw/neocles-20260326-182953.pdf -o Neocles_CV.pdf
```
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
