# Guia: Usando Variáveis de Ambiente (.env) com Docker

Ao rodar o **Lattes Scraper** localmente via Docker, a melhor prática **NÃO** é adicionar o arquivo `.env` dentro da imagem. Isso mantém a sua imagem Docker limpa, segura e desacoplada das suas chaves da API do Gemini. 

O Docker possui formas nativas e seguras de carregar essas variáveis a partir do seu ambiente de trabalho (host) direto para o interior do container em tempo de execução.

## Estrutura do `.env`

Certifique-se de que você possui um arquivo `.env` configurado na raiz do projeto (no diretório onde o `Dockerfile` está localizado). Ele deve seguir o modelo do seu `.env.example`:

```env
# Seu GEMINI API KEY aqui
GEMINI_API_KEY=AIzaSyB...
HEADLESS=true
```

## Como Injetar as Variáveis no Docker (Melhor Prática)

O método mais seguro e simples de injetar o arquivo `.env` na inicialização do container é utilizando o argumento `--env-file` pelo terminal.

### 1. Execute o Build
Construa sua imagem Docker normalmente, sem se preocupar em incluir o arquivo `.env`.

```bash
docker build -t lattes-scraper .
```

### 2. Rode o Container com `--env-file`
Para rodar a automação passando as chaves com sucesso, adicione a opção `--env-file .env` ao comando `docker run`.

```bash
docker run --rm --env-file .env lattes-scraper
```

Este comando instrui o Docker a ler o arquivo local `.env` no seu computador e preencher as variáveis secretas de ambiente **apenas na memória** do container. 

## No Código (Python)

A aplicação conta com um tratamento de fallback, que significa que ao rodar esse código no ambiente host (sem docker) o arquivo lê nativamente pelo uso de `load_dotenv` (biblioteca `python-dotenv`), e quando o mesmo código for executado no Docker a importação é ignorada de maneira silenciosa. As chaves serão puxadas pela aplicação via `os.environ` diretamente do Docker.

```python
try:
    from dotenv import load_dotenv
    # Carrega arquivos .env apenas se disponível na máquina host (DEV)
    load_dotenv()
except ImportError:
    pass # No Docker, as varíaveis já foram fornecidas pelo docker run --env-file .env
```

## Alternativas (Uso no Docker Desktop)

Se por acaso você preferir usar o **Docker Desktop** (a interface gráfica baseada em Desktop), siga estes passos:
1. Navegue até a tela do seu container criado na aba "Containers" (ou na etapa "Run" da aba "Images").
2. No painel apropriado ("Environment Variables" na aba "Optional Settings"), adicione as variáveis uma a uma:
    - **Variable:** `GEMINI_API_KEY`
    - **Value:** `(cole-a-chave-aqui)`
3. Você também pode mapear a variável `HEADLESS=true` para desativar a exibição da janela invisível do browser.
4. Clique em "Run".

## Troubleshooting frontend: `Module not found`

No modo de desenvolvimento com Docker Compose, o frontend usa bind mount do código e volumes nomeados para `node_modules` e `.next`.
Quando uma dependência nova é adicionada, esse volume pode ficar desatualizado e gerar erro como:

```text
Module not found: Can't resolve '<pacote>'
```

### Correção recomendada

```bash
docker compose down -v
docker compose up -d --build frontend
```

### Observação importante

O container de desenvolvimento do frontend não instala mais os navegadores do Playwright. Eles ficam isolados no perfil `frontend-e2e`, o que reduz uso de disco e tempo de build em PCs com pouco espaço livre.

Para uso rápido e estável, prefira o compose padrão:

```bash
docker compose up -d --build
```

Para desenvolvimento com hot reload, use o override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```
