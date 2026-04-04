import * as z from "zod";

import { DEFAULT_OUTPUT_FORMAT } from "@/features/lattes/lib/output-format";

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const IndividualSearchSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(255, "O nome não pode exceder 255 caracteres."),
  outputFormat: z.enum(["pdf", "docx", "json", "html", "csv", "all"]).default(DEFAULT_OUTPUT_FORMAT),
});

export type IndividualSearchFormData = z.infer<typeof IndividualSearchSchema>;

export const BatchUploadSchema = z.object({
  csvFile: z.custom<File>(isFile, {
    message: "Informe um arquivo CSV.",
  })
    .refine((file) => file.name.toLowerCase().endsWith(".csv"), {
      message: "Use apenas arquivos .csv.",
    })
    .refine((file) => file.size > 0, {
      message: "O arquivo nao pode estar vazio.",
    })
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "O arquivo nao pode exceder 5MB.",
    }),
  skip: z.coerce.number().int().min(0, "Esse valor nao pode ser negativo."),
  limit: z
    .union([
      z.literal(""),
      z.coerce.number().int().min(1, "Informe pelo menos 1."),
    ])
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  outputFormat: z.enum(["pdf", "docx", "json", "html", "csv", "all"]).default(DEFAULT_OUTPUT_FORMAT),
});

export type BatchUploadFormData = z.infer<typeof BatchUploadSchema>;
export type BatchUploadFormInput = z.input<typeof BatchUploadSchema>;

export const SummarySchema = z.object({
  provedor: z.enum(["openai", "gemini", "ollama"]),
  modelo: z.string().trim().min(1, "Escolha ou informe uma opcao."),
  apiKey: z.string().trim().optional(),
});

export type SummaryFormData = z.infer<typeof SummarySchema>;