import * as z from "zod";

import { DEFAULT_OUTPUT_FORMAT } from "@/features/lattes/lib/output-format";

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Quebra o texto colado em nomes individuais. Aceita ';' como separador
 * principal e também quebras de linha, ignorando espaços e entradas vazias.
 */
export function parseBatchNamesText(text: string | undefined | null): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/[;\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export const IndividualSearchSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(255, "O nome não pode exceder 255 caracteres."),
  outputFormat: z.enum(["pdf", "docx", "json", "html", "csv", "all"]).default(DEFAULT_OUTPUT_FORMAT),
});

export type IndividualSearchFormData = z.infer<typeof IndividualSearchSchema>;
export type IndividualSearchFormInput = z.input<typeof IndividualSearchSchema>;

export const BatchUploadSchema = z
  .object({
    csvFile: z.custom<File>(isFile).optional(),
    namesText: z.string().optional(),
    skip: z.coerce.number().int().min(0, "Esse valor não pode ser negativo."),
    limit: z
      .union([
        z.literal(""),
        z.coerce.number().int().min(1, "Informe pelo menos 1."),
      ])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    outputFormat: z
      .enum(["pdf", "docx", "json", "html", "csv", "all"])
      .default(DEFAULT_OUTPUT_FORMAT),
  })
  .superRefine((data, ctx) => {
    const hasFile = isFile(data.csvFile);
    const names = parseBatchNamesText(data.namesText);

    // Exige ao menos uma fonte de nomes (texto colado ou arquivo CSV).
    // A mensagem é anexada às duas fontes para aparecer em qualquer um dos modos.
    if (!hasFile && names.length === 0) {
      const message = "Cole ao menos um nome ou envie um arquivo CSV.";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["namesText"],
        message,
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["csvFile"],
        message,
      });
      return;
    }

    // Valida o arquivo apenas quando ele é a fonte escolhida.
    if (hasFile) {
      const file = data.csvFile as File;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["csvFile"],
          message: "Use apenas arquivos .csv.",
        });
      }
      if (file.size <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["csvFile"],
          message: "O arquivo não pode estar vazio.",
        });
      }
      if (file.size > MAX_CSV_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["csvFile"],
          message: "O arquivo não pode exceder 5MB.",
        });
      }
    }
  });

export type BatchUploadFormData = z.infer<typeof BatchUploadSchema>;
export type BatchUploadFormInput = z.input<typeof BatchUploadSchema>;

export const SummarySchema = z.object({
  provedor: z.enum(["openai", "gemini", "ollama"]),
  modelo: z.string().trim().min(1, "Escolha ou informe uma opção."),
  apiKey: z.string().trim().optional(),
});

export type SummaryFormData = z.infer<typeof SummarySchema>;