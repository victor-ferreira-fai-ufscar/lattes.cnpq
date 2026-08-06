/**
 * O `href` do resultado de busca do Lattes não é um endereço.
 *
 * A lista de resultados da plataforma não usa link de verdade: cada nome é um
 * `<a>` cujo href chama a função da própria página, no formato
 * `javascript:abreDetalhe('K4318913H4','Nome_Da_Pessoa',61543893)`. O scraper
 * guarda essa string porque ela é o que identifica o candidato de forma estável
 * — é a chave usada para selecionar e comparar candidatos no fluxo individual.
 *
 * Serve como identidade, não como texto para o usuário. O primeiro argumento é
 * o ID Lattes, que é o que de fato distingue dois homônimos na lista.
 */

const RE_ABRE_DETALHE = /abreDetalhe\(\s*'([^']+)'/;

/** ID Lattes do candidato, ou `null` se o href não tiver o formato esperado. */
export function extrairIdLattes(href: string): string | null {
  const encontrado = RE_ABRE_DETALHE.exec(href);
  if (!encontrado) {
    return null;
  }

  const id = encontrado[1].trim();
  return id || null;
}
