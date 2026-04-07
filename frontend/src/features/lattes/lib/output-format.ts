export type OutputFormat = "pdf" | "docx" | "json" | "html" | "csv" | "all";

export const DEFAULT_OUTPUT_FORMAT: OutputFormat = "pdf";

export const OUTPUT_FORMAT_OPTIONS: Array<{
  value: OutputFormat;
  label: string;
  description: string;
}> = [
  {
    value: "docx",
    label: "DOCX",
    description: "Gera um documento baseado no modelo disponível e no texto extraído.",
  },
  {
    value: "json",
    label: "JSON",
    description: "Entrega os dados extraídos em formato estruturado.",
  },
  {
    value: "html",
    label: "HTML",
    description: "Cria uma versão navegável do conteúdo extraído.",
  },
  {
    value: "csv",
    label: "CSV",
    description: "Exporta uma linha com metadados e texto normalizado.",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "Salva uma cópia local do PDF gerado do currículo.",
  },
  {
    value: "all",
    label: "Todos os formatos",
    description: "Gera DOCX, JSON, HTML, CSV e PDF em uma única pasta.",
  },
];

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  docx: "DOCX",
  json: "JSON",
  html: "HTML",
  csv: "CSV",
  pdf: "PDF",
  all: "Todos os formatos",
};