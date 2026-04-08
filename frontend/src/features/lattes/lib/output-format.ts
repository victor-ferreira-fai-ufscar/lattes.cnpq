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
    description: "Gera um documento editável para leitura e ajustes posteriores.",
  },
  {
    value: "json",
    label: "JSON",
    description: "Entrega os dados em formato estruturado para integração ou análise técnica.",
  },
  {
    value: "html",
    label: "HTML",
    description: "Cria uma versão para abrir no navegador com navegação mais simples.",
  },
  {
    value: "csv",
    label: "CSV",
    description: "Exporta os dados em formato de planilha para conferência e organização.",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "Baixa o PDF do currículo para leitura direta.",
  },
  {
    value: "all",
    label: "Todos os formatos",
    description: "Gera todos os formatos em uma única pasta para você escolher depois.",
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