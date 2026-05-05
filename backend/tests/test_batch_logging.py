from src.api.routers import batch as batch_router
from src.libs.logging import summarize_exception


def test_summarize_exception_extracts_timeout_and_locator() -> None:
    error = RuntimeError(
        "Locator.click: Timeout 30000ms exceeded. Call log: "
        '- waiting for locator("a").first '
        "- element is not visible"
    )

    info = summarize_exception(error)

    assert info["tipo"] == "RuntimeError"
    assert info["timeout_ms"] == 30000
    assert info["locator"] == "a"
    assert isinstance(info["resumo"], str)
    assert "Timeout (30000ms)" in info["resumo"]
    assert "locator 'a'" in info["resumo"]
    assert isinstance(info["detalhe"], str)
    assert "Locator.click: Timeout 30000ms exceeded." in info["detalhe"]


async def test_process_batch_keeps_logs_clean_and_adds_debug_fields(
    monkeypatch,
) -> None:
    async def fake_scrape_lattes(_: str):
        raise RuntimeError(
            "Locator.click: Timeout 30000ms exceeded. Call log: "
            '- waiting for locator("a").first '
            "- element is not visible - retrying click action"
        )

    monkeypatch.setattr(
        batch_router, "find_fresh_curriculo_pdf", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(batch_router, "scrape_lattes", fake_scrape_lattes)

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Cecilia Malvezzi"],
        nomes=["Cecilia Malvezzi"],
        skip_value=0,
        limit_value=1,
    )

    assert result["sucesso"] == 0
    assert result["erro"] == 1
    assert result["zip_arquivo"] is None

    item = result["resultados"][0]
    assert item["status"] == "erro"
    assert item["erro_tipo"] == "RuntimeError"
    assert item["erro_timeout_ms"] == 30000
    assert item["erro_locator"] == "a"
    assert "Timeout (30000ms)" in item["erro"]
    assert len(item["erro"]) < len(item["erro_detalhe"])

    logs = result["logs"]
    assert any(
        "Erro para 'Cecilia Malvezzi': Timeout (30000ms)" in line for line in logs
    )
    assert any(
        "Debug erro para 'Cecilia Malvezzi': tipo=RuntimeError" in line for line in logs
    )
