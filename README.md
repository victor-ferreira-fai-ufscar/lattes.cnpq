# 🎓 Lattes Automator AI

Ferramenta inteligente para extração e resumo de currículos da Plataforma Lattes. Ideal para pesquisadores, gestores acadêmicos e analistas que precisam de resumos executivos de alta qualidade a partir de perfis do CNPq.

---

## 🚀 Como Executar (Usuário Leigo)

Se você é um usuário leigo no Windows, preparamos um lançador automático para facilitar sua vida:

1.  **Obter a Ferramenta**: Baixe esta pasta e descompacte em seu computador.
2.  **Lançador**: Clique duas vezes no arquivo **`run.bat`**.
3.  **Aguarde**: Ele instalará tudo o que for necessário automaticamente (na primeira vez pode demorar uns 2 minutos).
4.  **Acesse**: O navegador abrirá automaticamente em `http://localhost:8501`.

> [!TIP]
> **Dica de Ouro**: Você pode criar um atalho do arquivo `run.bat` e arrastá-lo para sua Área de Trabalho (Desktop) para abri-lo como qualquer outro programa.

---

## 🔑 Configurando sua Chave API (Gemini)

Para que a inteligência artificial funcione, você precisa de uma chave gratuita do Google:

1.  Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Clique em **"Create API key"**.
3.  Copie o código gerado.
4.  No aplicativo (Streamlit), cole essa chave na **Barra Lateral esquerda (Configurações)**.

---

## 📋 Funcionalidades Principais

- **Busca Individual**: Basta digitar o nome completo e o robô vai até o site do CNPq buscar os dados.
- **Processamento em Lote**: Faça upload de um arquivo `.txt` ou `.csv` com vários nomes e processe todos de uma vez.
- **Trace Route**: Acompanhe em tempo real o que o robô está fazendo ("Acessando site...", "Extraindo texto...", "IA analisando...").
- **Relatório Word**: Gere automaticamente um arquivo `.docx` profissional e editável para cada professor.

---

## 🛠️ Detalhes Técnicos (Para Desenvolvedores)

- **Backend**: Python 3.10+
- **Scraper**: Playwright (Modo Headless/Headful)
- **IA**: Google Gemini pro/flash API
- **Frontend**: Streamlit 1.32.2+
- **Gestão**: `uv` (Astral)

### Erros Comuns
- **Quota Exceeded (429)**: Se a cota da chave gratuita acabar, gere uma nova chave no AI Studio e troque na barra lateral do app.
- **Playwright Not Installed**: O `run.bat` já tenta instalar o Chromium automaticamente com `playwright install chromium`.

---
Desenvolvido com foco em produtividade acadêmica.
