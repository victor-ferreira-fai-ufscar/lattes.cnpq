"""Normalização e variações de nomes de docentes.

Extraído de `core/scraper.py` porque a busca no Lattes deixou de ser a única
consumidora: o enriquecimento externo (`core/perfil_externo.py`) precisa das
mesmas regras para casar o nome do docente com autores do OpenAlex e com
manchetes de notícias.
"""

from __future__ import annotations

import unicodedata


def normalizar(texto: str) -> str:
    """Minúsculas com espaços colapsados — chave estável de comparação."""
    return " ".join(texto.lower().split())


def remover_acentos(texto: str) -> str:
    texto_norm = unicodedata.normalize("NFD", texto)
    return "".join(ch for ch in texto_norm if unicodedata.category(ch) != "Mn")


def chave_comparacao(texto: str) -> str:
    """Forma canônica para comparar nomes: sem acento e normalizado."""
    return normalizar(remover_acentos(texto))


def gerar_variacoes_nome_busca(nome: str) -> list[str]:
    """Variações do nome, da mais específica para a mais genérica.

    A ordem importa: a busca do Lattes tenta uma a uma e para na primeira que
    retorna resultado, então o nome completo vem antes de "primeiro + último" e
    do primeiro nome isolado.
    """
    nome_limpo = " ".join(nome.split())
    if not nome_limpo:
        return []

    partes = nome_limpo.split()
    variacoes = [
        nome_limpo,
        remover_acentos(nome_limpo),
        nome_limpo.lower(),
        remover_acentos(nome_limpo).lower(),
        nome_limpo.title(),
    ]

    if len(partes) >= 2:
        variacoes.append(f"{partes[0]} {partes[-1]}")
        variacoes.append(partes[0])

    unicos: list[str] = []
    vistos: set[str] = set()
    for variacao in variacoes:
        texto = " ".join(variacao.split())
        chave = normalizar(texto)
        if not texto or chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(texto)

    return unicos
