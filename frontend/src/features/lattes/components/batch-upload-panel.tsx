"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
  BatchUploadSchema,
  type BatchUploadFormData,
  type BatchUploadFormInput,
} from "@/features/lattes/schemas/lattes.schemas";

type BatchUploadPanelProps = {
  isSubmitting: boolean;
  onSubmitBatch: (file: File, skip: number, limit?: number) => Promise<void>;
};

export function BatchUploadPanel({
  isSubmitting,
  onSubmitBatch,
}: BatchUploadPanelProps) {
  const form = useForm<BatchUploadFormInput, unknown, BatchUploadFormData>({
    resolver: zodResolver(BatchUploadSchema),
    defaultValues: {
      skip: 0,
      limit: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmitBatch(values.csvFile, values.skip, values.limit);
  });

  return (
    <Card variant="panel">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Lista em CSV
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Processe varias pessoas de uma vez
          </CardTitle>
          <CardDescription>
            Envie um arquivo CSV simples, com um nome por linha. Ao final, voce
            podera baixar os curriculos encontrados em um unico arquivo.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="csvFile"
              render={({ field, fieldState }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Arquivo com os nomes</FormLabel>
                  <FormControl>
                    <FileDropzone
                      accept=".csv,text/csv"
                      error={!!fieldState.error}
                      value={field.value as File | undefined}
                      onChange={(file) => field.onChange(file)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="skip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pular primeiras linhas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={String(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>Use 0 para comecar do inicio.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade maxima</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Deixe em branco para processar tudo"
                      type="number"
                      min={1}
                      {...field}
                      value={String(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Enviando lista..." : "Processar lista"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}