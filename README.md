# Lattes Scraper & Summarizer 🚀

Este projeto consiste em um bot construído em Python que utiliza o **Playwright** para acessar a plataforma do Currículo Lattes, buscar automaticamente e extrair os dados de um professor (padrão: Neocles) e enviá-los de forma agnóstica para a API do **Gemini (Google GenAI)** gerar um robusto **Resumo Executivo** focando nas áreas de atuação e nas principais realizações.

Tudo foi construído visando estabilidade e performance utilizando ferramentas modernas como arquitetura async, o gerenciador super-rápido `uv`, e ambientes conteinerizados sem conflitos.

## 🗝️ Pré-requisitos
1. Uma Chave de API do Gemini. Você pode gerar a sua gratuitamente no [Google AI Studio](https://aistudio.google.com/api-keys).
2. Configure o seu ambiente criando um arquivo `.env` na raiz do projeto. Basta renomear o arquivo modelo `.env.example` e colar a sua chave recém-criada:
   ```env
   GEMINI_API_KEY="COLE-SUA-CHAVE-AQUI"
   ```

Existem duas formas de iniciar o bot. **A via recomendada é utilizando o Docker**.

## 🐳 Opção 1: Executando via Docker (Recomendado)

O Docker garante total isolamento de dependências. Você não vai poluir sua máquina com binários do Python ou o navegador Chromium isolado do Playwright: tudo roda dentro e morre dentro do ambiente volátil limpo!

```bash
# 1. Faça o build da imagem isolada
docker build -t lattes-scraper .

# 2. Execute o bot, referenciando o arquivo de senhas (.env)
docker run --rm --env-file .env lattes-scraper
```

## 💻 Opção 2: Executando Localmente com `uv`

Caso queira debugar o arquivo `scraper.py`, ler o código com suporte ao **IntelliSense** nativo em seu editor ou simplesmente não queira lidar com containers nesse momento, você pode perfeitamente rodar o bot no seu Windows nativamente:

```bash
# 1. Obtenha e sincronize as dependências num sub-ambiente limpo na pasta
uv sync

# 2. Baixe e instale a versão oculta nativa do Chrome que o bot exige
uv run playwright install chromium

# 3. Execute o robô! (As suas chaves do .env local serão puxadas magicamente pelo python-dotenv)
uv run scraper.py
```

## 🤖 Como Funciona o Fluxo?
- O robô navega até a [Busca Textual do CNPq](https://buscatextual.cnpq.br/buscatextual/busca.do?metodo=apresentar).
- Preenche a caixa de busca com o nome determinado (`Neocles`) e cruza pelos modais legados do Lattes.
- Abre o currículo original de forma paralela e em seguida raspa *todo* o documento HTML visível.
- As informações completas são injetadas no SDK oficial da Google para o gigantesco modelo **`gemini-2.5-flash`**. 
- O modelo processa as páginas acadêmicas extensas e emite na tela um resumo objetivo sem enrolação.
