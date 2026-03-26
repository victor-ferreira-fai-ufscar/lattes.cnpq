@echo off
chcp 65001 >nul
title Lattes Automator AI - Iniciando...

echo.
echo  ============================================
echo    🎓 Lattes Automator AI - Launcher
echo  ============================================
echo.

:: Verifica se uv existe
where uv >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] O gerenciador 'uv' nao foi encontrado.
    echo     Instale em: https://docs.astral.sh/uv/getting-started/installation/
    echo.
    pause
    exit /b 1
)

echo [*] Instalando/atualizando dependencias...
uv sync
if %ERRORLEVEL% neq 0 (
    echo [!] Erro ao sincronizar dependencias.
    pause
    exit /b 1
)

echo [*] Instalando navegador Chromium para o Playwright...
uv run playwright install chromium >nul 2>nul

echo.
echo [OK] Tudo pronto! Abrindo a interface no navegador...
echo      Endereco: http://localhost:8501
echo.
echo  (Mantenha esta janela aberta enquanto usar a ferramenta)
echo  (Para fechar, pressione Ctrl+C ou feche esta janela)
echo.

:: Abre o navegador e inicia o Streamlit
start http://localhost:8501
uv run streamlit run app.py --server.headless=true
