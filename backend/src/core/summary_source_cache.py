"""Cache em memória do texto-base usado pelo resumo do currículo.

O endpoint /summarize re-scrapeia o currículo do zero a cada chamada. Com o
resumo por seção, é comum o usuário gerar vários resumos da mesma pessoa (um por
seção) em sequência, o que dispararia um scraping completo (Playwright) a cada
vez. Este cache guarda o LattesSummarySourceResult por nome durante uma janela
curta (TTL), de modo que trocar de seção e regerar reaproveita o mesmo texto.

É um cache de processo (some ao reiniciar o backend), com TTL configurável via
SUMMARY_SOURCE_CACHE_TTL (segundos). Um lock por chave evita que requisições
concorrentes para o mesmo nome disparem scrapings duplicados.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Callable

from .scraper import LattesSummarySourceResult, scrape_lattes_summary_source

LogFn = Callable[[str], None]

# Janela de validade padrão: 15 minutos. Curta o suficiente para não servir um
# currículo desatualizado por muito tempo, e longa o suficiente para cobrir a
# geração de resumos de várias seções da mesma pessoa em sequência.
_TTL_PADRAO_SEGUNDOS = 15 * 60

# Limite de entradas para não crescer indefinidamente em uso prolongado.
_MAX_ENTRADAS = 64

_cache: dict[str, tuple[float, LattesSummarySourceResult]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _ttl_segundos() -> float:
    bruto = os.environ.get("SUMMARY_SOURCE_CACHE_TTL", "").strip()
    if not bruto:
        return float(_TTL_PADRAO_SEGUNDOS)
    try:
        valor = float(bruto)
    except ValueError:
        return float(_TTL_PADRAO_SEGUNDOS)
    return valor if valor >= 0 else float(_TTL_PADRAO_SEGUNDOS)


def _chave(nome: str) -> str:
    return " ".join(nome.lower().split())


def _entrada_valida(chave: str) -> LattesSummarySourceResult | None:
    entrada = _cache.get(chave)
    if not entrada:
        return None

    salvo_em, resultado = entrada
    if (time.monotonic() - salvo_em) >= _ttl_segundos():
        _cache.pop(chave, None)
        return None
    return resultado


def _guardar(chave: str, resultado: LattesSummarySourceResult) -> None:
    # Eviction simples: remove a entrada mais antiga quando estoura o limite.
    if len(_cache) >= _MAX_ENTRADAS and chave not in _cache:
        mais_antiga = min(_cache, key=lambda k: _cache[k][0])
        _cache.pop(mais_antiga, None)
    _cache[chave] = (time.monotonic(), resultado)


async def get_summary_source(
    nome: str,
    *,
    log: LogFn | None = None,
    force_refresh: bool = False,
) -> LattesSummarySourceResult:
    """Retorna o texto-base do currículo, do cache quando válido.

    Erros do scraping (ex.: currículo não encontrado) propagam normalmente e não
    são cacheados.
    """
    chave = _chave(nome)

    if not force_refresh:
        em_cache = _entrada_valida(chave)
        if em_cache is not None:
            if log:
                log(
                    "Reaproveitando o texto do currículo já coletado nesta sessão "
                    "(sem novo acesso ao Lattes)."
                )
            return em_cache

    lock = _locks.setdefault(chave, asyncio.Lock())
    async with lock:
        # Re-checa após adquirir o lock: outra requisição pode ter preenchido o
        # cache enquanto esperávamos.
        if not force_refresh:
            em_cache = _entrada_valida(chave)
            if em_cache is not None:
                if log:
                    log(
                        "Reaproveitando o texto do currículo já coletado nesta sessão "
                        "(sem novo acesso ao Lattes)."
                    )
                return em_cache

        resultado = await scrape_lattes_summary_source(nome)
        _guardar(chave, resultado)
        return resultado


def limpar_cache() -> None:
    """Limpa o cache (útil em testes)."""
    _cache.clear()
    _locks.clear()
