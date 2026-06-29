export type SummarySection =
  | "completo"
  | "resumo"
  | "formacao"
  | "atuacao"
  | "producao"
  | "orientacoes"
  | "projetos";

export const DEFAULT_SUMMARY_SECTION: SummarySection = "completo";

// Tupla literal usada pelo zod (z.enum) e como fonte única dos valores válidos.
export const SUMMARY_SECTION_VALUES = [
  "completo",
  "resumo",
  "formacao",
  "atuacao",
  "producao",
  "orientacoes",
  "projetos",
] as const;

export const SUMMARY_SECTION_OPTIONS: Array<{
  value: SummarySection;
  label: string;
  description: string;
}> = [
  {
    value: "completo",
    label: "Currículo completo",
    description: "Resume todas as seções do currículo (comportamento padrão).",
  },
  {
    value: "resumo",
    label: "Resumo informado pelo autor",
    description: "Apenas a apresentação que o próprio docente faz de si.",
  },
  {
    value: "formacao",
    label: "Formação acadêmica/titulação",
    description: "Graduação, mestrado, doutorado, pós-doutorado e distinções.",
  },
  {
    value: "atuacao",
    label: "Atuação profissional",
    description: "Vínculos institucionais, cargos, regime e períodos.",
  },
  {
    value: "producao",
    label: "Produção bibliográfica",
    description: "Publicações por tipo e temas predominantes.",
  },
  {
    value: "orientacoes",
    label: "Orientações",
    description: "Orientações concluídas e em andamento, por nível.",
  },
  {
    value: "projetos",
    label: "Projetos de pesquisa",
    description: "Projetos e linhas de pesquisa, temas e financiadores.",
  },
];

export const SUMMARY_SECTION_LABELS: Record<SummarySection, string> =
  SUMMARY_SECTION_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.label;
      return acc;
    },
    {} as Record<SummarySection, string>,
  );
