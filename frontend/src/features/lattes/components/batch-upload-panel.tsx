"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_OUTPUT_FORMAT,
  OUTPUT_FORMAT_OPTIONS,
} from "@/features/lattes/lib/output-format";
import {
  BatchUploadSchema,
  parseBatchNamesText,
  type BatchUploadFormData,
  type BatchUploadFormInput,
} from "@/features/lattes/schemas/lattes.schemas";

type BatchInputMode = "texto" | "csv";

type BatchUploadPanelProps = {
  disabled: boolean;
  isSubmitting: boolean;
  onSubmitBatch: (
    file: File,
    skip: number,
    limit: number | undefined,
    outputFormat: import("@/features/lattes/lib/output-format").OutputFormat,
  ) => Promise<void>;
};

export function BatchUploadPanel({
  disabled,
  isSubmitting,
  onSubmitBatch,
}: BatchUploadPanelProps) {
  const [mode, setMode] = useState<BatchInputMode>("texto");

  const form = useForm<BatchUploadFormInput, unknown, BatchUploadFormData>({
    resolver: zodResolver(BatchUploadSchema),
    defaultValues: {
      namesText: "",
      skip: 0,
      limit: "",
      outputFormat: DEFAULT_OUTPUT_FORMAT,
    },
  });

  const switchMode = (next: BatchInputMode) => {
    if (next === mode) {
      return;
    }
    // Limpa a fonte do modo anterior para não enviar dados antigos.
    if (next === "texto") {
      form.setValue("csvFile", undefined, { shouldValidate: false });
    } else {
      form.setValue("namesText", "", { shouldValidate: false });
    }
    form.clearErrors(["namesText", "csvFile"]);
    setMode(next);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    let file: File;
    if (mode === "texto") {
      const names = parseBatchNamesText(values.namesText);
      // Um nome por linha: parse_csv_names (backend) usa a 1ª célula de cada linha.
      file = new File([names.join("\n")], "nomes-colados.csv", {
        type: "text/csv",
      });
    } else {
      file = values.csvFile as File;
    }

    await onSubmitBatch(file, values.skip, values.limit, values.outputFormat);
  });

  return (
    <Card variant="panel">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Busca em lote
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Processe várias pessoas de uma vez
          </CardTitle>
          <CardDescription>
            Cole os nomes separados por ponto e vírgula (;) ou envie um arquivo
            CSV com um nome por linha. Ao final, você poderá baixar os currículos
            encontrados em um único arquivo.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2 space-y-3">
              <div
                className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
                role="tablist"
                aria-label="Como informar os nomes"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "texto"}
                  disabled={disabled}
                  onClick={() => switchMode("texto")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                    mode === "texto"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  Colar nomes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "csv"}
                  disabled={disabled}
                  onClick={() => switchMode("csv")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                    mode === "csv"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Enviar CSV
                </button>
              </div>

              {mode === "texto" ? (
                <FormField
                  control={form.control}
                  name="namesText"
                  render={({ field }) => {
                    const total = parseBatchNamesText(field.value).length;
                    return (
                      <FormItem>
                        <FormLabel>Nomes dos perfis</FormLabel>
                        <FormControl>
                          <Textarea
                            disabled={disabled}
                            rows={5}
                            placeholder="Ex.: Maria Silva; João Souza; Ana Costa"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Separe os nomes por ponto e vírgula (;) ou por quebra de
                          linha.
                          {total > 0
                            ? ` ${total} nome(s) identificado(s).`
                            : ""}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="csvFile"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Arquivo com os nomes</FormLabel>
                      <FormControl>
                        <FileDropzone
                          accept=".csv,text/csv"
                          disabled={disabled}
                          error={!!fieldState.error}
                          value={field.value as File | undefined}
                          onChange={(file) => field.onChange(file)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="skip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pular primeiras linhas</FormLabel>
                  <FormControl>
                    <Input
                      disabled={disabled}
                      type="number"
                      min={0}
                      {...field}
                      value={String(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Use 0 para começar pela primeira linha do arquivo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade máxima</FormLabel>
                  <FormControl>
                    <Input
                      disabled={disabled}
                      placeholder="Deixe em branco para processar tudo"
                      type="number"
                      min={1}
                      {...field}
                      value={String(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Preencha apenas se quiser testar com uma parte da lista.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="outputFormat"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Formato de saída</FormLabel>
                  <Select disabled={disabled} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o formato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTPUT_FORMAT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {
                      OUTPUT_FORMAT_OPTIONS.find(
                        (option) => option.value === field.value,
                      )?.description
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              <Button className="w-full sm:w-auto" disabled={disabled || isSubmitting} type="submit">
                {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
                {isSubmitting ? "Enviando lista..." : "Processar lista"}
              </Button>
              {isSubmitting ? (
                <p className="mt-3 text-sm text-amber-800">
                  A lista foi enviada. O processamento pode levar mais tempo para lotes maiores.
                </p>
              ) : null}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}