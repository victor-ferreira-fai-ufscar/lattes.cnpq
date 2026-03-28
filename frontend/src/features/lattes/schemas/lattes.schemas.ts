import * as z from "zod";

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const IndividualSearchSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(255, "O nome não pode exceder 255 caracteres."),
});

export type IndividualSearchFormData = z.infer<typeof IndividualSearchSchema>;

export const BatchUploadSchema = z.object({
  csvFile: z.custom<File>(isFile, {
    message: "Arquivo CSV é obrigatório.",
  })
    .refine((file) => file.name.toLowerCase().endsWith(".csv"), {
      message: "Apenas arquivos .csv são permitidos.",
    })
    .refine((file) => file.size > 0, {
      message: "O arquivo não pode estar vazio.",
    })
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "O arquivo não pode exceder 5MB.",
    }),
  skip: z.coerce.number().int().min(0, "Skip não pode ser negativo."),
  limit: z
    .union([
      z.literal(""),
      z.coerce.number().int().min(1, "Limit deve ser pelo menos 1."),
    ])
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type BatchUploadFormData = z.infer<typeof BatchUploadSchema>;
export type BatchUploadFormInput = z.input<typeof BatchUploadSchema>;

export const SummarySchema = z.object({
  provedor: z.enum(["openai", "gemini", "ollama"]),
  modelo: z.string().trim().min(1, "Escolha ou informe um modelo."),
  apiKey: z.string().trim().optional(),
});

export type SummaryFormData = z.infer<typeof SummarySchema>;