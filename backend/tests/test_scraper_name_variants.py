from pathlib import Path

from src.core import scraper


def _load_csv_names() -> list[str]:
    csv_path = (
        Path(__file__).resolve().parents[2] / "docs" / "csv" / "50-nomes-docentes.csv"
    )
    lines = csv_path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip()]


def test_generate_name_variants_for_csv_names() -> None:
    names = _load_csv_names()

    assert len(names) == 50

    for name in names:
        variants = scraper._gerar_variacoes_nome_busca(name)
        normalized = {scraper._normalizar(item) for item in variants}

        assert variants
        assert name in variants
        assert len(normalized) == len(variants)


def test_generate_name_variants_include_accentless_and_partial() -> None:
    variants = set(scraper._gerar_variacoes_nome_busca("Armando Polido Júnior"))

    assert "Armando Polido Júnior" in variants
    assert "Armando Polido Junior" in variants
    assert "Armando Júnior" in variants
    assert "Armando" in variants


def test_detect_no_result_text_signals() -> None:
    assert scraper._parece_sem_resultado("Nenhum resultado encontrado")
    assert scraper._parece_sem_resultado("Resultado de 0 curriculos")
    assert scraper._parece_sem_resultado("Nenhum currículo foi encontrado")
    assert not scraper._parece_sem_resultado("Resultado de 12 curriculos")
