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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card className="border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Fluxo em lote
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Processar múltiplos currículos via CSV
          </CardTitle>
          <CardDescription>
            Envie um arquivo CSV com um nome de docente por linha. Os
            currículos serão buscados automaticamente e empacotados em um ZIP
            para download.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="batch-csv-file">Arquivo CSV</Label>
            <Input
              id="batch-csv-file"
              accept=".csv,text/csv"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                form.setValue("csvFile", file as File, { shouldValidate: true });
              }}
            />
            {form.formState.errors.csvFile ? (
              <p className="text-sm font-medium text-red-600">
                {form.formState.errors.csvFile.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-skip">Skip inicial</Label>
            <Input id="batch-skip" type="number" {...form.register("skip")} />
            {form.formState.errors.skip ? (
              <p className="text-sm font-medium text-red-600">
                {form.formState.errors.skip.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-limit">Limite de itens</Label>
            <Input
              id="batch-limit"
              placeholder="Opcional"
              type="number"
              {...form.register("limit")}
            />
            {form.formState.errors.limit ? (
              <p className="text-sm font-medium text-red-600">
                {form.formState.errors.limit.message as string}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando lote..." : "Executar lote"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}