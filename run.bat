@echo off
chcp 65001 >nul
title Lattes Automator AI - Launcher

echo.
echo ============================================
echo   Lattes Automator AI - Launcher
echo ============================================
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
uv sync --quiet
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
echo (Mantenha esta janela aberta enquanto usar a ferramenta)
echo (Para fechar, pressione Ctrl+C ou feche esta janela)
echo.

:: Inicia o Streamlit
uv run streamlit run app.py --server.port 8501 --server.headless true
