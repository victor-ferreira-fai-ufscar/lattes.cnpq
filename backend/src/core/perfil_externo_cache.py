"""Cache em memória do enriquecimento externo do docente.

Um lote de ~50 docentes dispara ~100 chamadas HTTP (OpenAlex + Google News). Se
o mesmo lote for reprocessado no mesmo dia — cenário comum ao ajustar o formato
de saída ou reexecutar após erro — repetir tudo é desperdício, e dado externo
muda devagar. Daí o TTL padrão longo (24h), configurável em
PERFIL_EXTERNO_CACHE_TTL.

Mesmo desenho de summary_source_cache.py: cache de processo (some no restart),
com lock por chave para que requisições concorrentes do mesmo nome não disparem
coletas duplicadas.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Callable, Optional

from ..libs.nomes import chave_comparacao
from .perfil_externo import PerfilExterno, coletar_perfil_externo

LogFn = Callable[[str], None]

_TTL_PADRAO_SEGUNDOS = 24 * 60 * 60

# Um lote são ~50 docentes; o limite cobre alguns lotes em sequência.
_MAX_ENTRADAS = 256

_cache: dict[str, tuple[float, Optional[PerfilExterno]]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _ttl_segundos() -> float:
    bruto = os.environ.get("PERFIL_EXTERNO_CACHE_TTL", "").strip()
    if not bruto:
        return float(_TTL_PADRAO_SEGUNDOS)
    try:
        valor = float(bruto)
    except ValueError:
        return float(_TTL_PADRAO_SEGUNDOS)
    return valor if valor >= 0 else float(_TTL_PADRAO_SEGUNDOS)


def _chave(nome: str, *, com_curriculo: bool) -> str:
    # O texto do currículo entra na desambiguação, então um perfil calculado sem
    # ele não pode ser servido para uma chamada que tem o texto (e vice-versa):
    # a confiança seria diferente.
    sufixo = "cv" if com_curriculo else "sem-cv"
    return f"{chave_comparacao(nome)}|{sufixo}"


def _entrada_valida(chave: str) -> tuple[bool, Optional[PerfilExterno]]:
    entrada = _cache.get(chave)
    if not entrada:
        return False, None

    salvo_em, perfil = entrada
    if (time.monotonic() - salvo_em) >= _ttl_segundos():
        _cache.pop(chave, None)
        return False, None
    return True, perfil


def _guardar(chave: str, perfil: Optional[PerfilExterno]) -> None:
    if len(_cache) >= _MAX_ENTRADAS and chave not in _cache:
        mais_antiga = min(_cache, key=lambda k: _cache[k][0])
        _cache.pop(mais_antiga, None)
    _cache[chave] = (time.monotonic(), perfil)


async def get_perfil_externo(
    nome: str,
    *,
    texto_curriculo: Optional[str] = None,
    log: Optional[LogFn] = None,
    force_refresh: bool = False,
) -> Optional[PerfilExterno]:
    """Perfil externo do docente, reaproveitando o resultado dentro do TTL."""
    chave = _chave(nome, com_curriculo=bool(texto_curriculo))

    if not force_refresh:
        encontrado, perfil = _entrada_valida(chave)
        if encontrado:
            if log:
                log(f"Perfil externo de '{nome}' reaproveitado do cache em memória.")
            return perfil

    lock = _locks.setdefault(chave, asyncio.Lock())
    async with lock:
        if not force_refresh:
            encontrado, perfil = _entrada_valida(chave)
            if encontrado:
                if log:
                    log(
                        f"Perfil externo de '{nome}' reaproveitado do cache em memória."
                    )
                return perfil

        perfil = await coletar_perfil_externo(
            nome, texto_curriculo=texto_curriculo, log=log
        )
        _guardar(chave, perfil)
        return perfil


def limpar_cache() -> None:
    """Limpa o cache (útil em testes)."""
    _cache.clear()
    _locks.clear()
