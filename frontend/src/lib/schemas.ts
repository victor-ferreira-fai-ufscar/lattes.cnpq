import * as z from "zod";

export const IndividualSearchSchema = z.object({
  nome: z
    .string()
    .min(1, "Informe o nome do docente.")
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(255, "O nome não pode exceder 255 caracteres."),
});

export type IndividualSearchFormData = z.infer<typeof IndividualSearchSchema>;

export const BatchUploadSchema = z
  .object({
    csvFile: z
      .instanceof(File, { message: "Arquivo CSV é obrigatório." })
      .refine(
        (file) => file.name.toLowerCase().endsWith(".csv"),
        "Apenas arquivos .csv são permitidos."
      )
      .refine(
        (file) => file.size > 0,
        "O arquivo não pode estar vazio."
      )
      .refine(
        (file) => file.size <= 5 * 1024 * 1024, // 5MB
        "O arquivo não pode exceder 5MB."
      ),
    skip: z.number().int("Skip deve ser um número inteiro.").min(0, "Skip não pode ser negativo."),
    limit: z
      .number()
      .int("Limit deve ser um número inteiro.")
      .min(1, "Limit deve ser pelo menos 1.")
      .optional(),
  })
  .strip();

export type BatchUploadFormData = z.infer<typeof BatchUploadSchema>;
