"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BrainCircuit, RefreshCcw } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SummarySchema,
  type SummaryFormData,
} from "@/features/lattes/schemas/lattes.schemas";
import type { AIProvider } from "@/features/lattes/services/lattes.service";

type SummaryPanelProps = {
  defaultValues: SummaryFormData;
  models: string[];
  isLoadingModels: boolean;
  isSubmitting: boolean;
  onLoadModels: (values: {
    provedor: AIProvider;
    apiKey?: string;
  }) => Promise<void>;
  onSubmitSummary: (values: SummaryFormData) => Promise<void>;
};

export function SummaryPanel({
  defaultValues,
  models,
  isLoadingModels,
  isSubmitting,
  onLoadModels,
  onSubmitSummary,
}: SummaryPanelProps) {
  const form = useForm<SummaryFormData>({
    resolver: zodResolver(SummarySchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const provedor = useWatch({
    control: form.control,
    name: "provedor",
  });
  const modelo = useWatch({
    control: form.control,
    name: "modelo",
  });

  const handleLoadModels = async () => {
    const values = form.getValues();
    await onLoadModels({
      provedor: values.provedor,
      apiKey: values.apiKey,
    });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmitSummary(values);
  });

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
          <BrainCircuit className="h-3.5 w-3.5" />
          Resumo opcional
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Gerar resumo com IA
          </CardTitle>
          <CardDescription>
            Se quiser, a ferramenta pode montar um texto mais curto para ajudar
            na leitura rapida do curriculo.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="summary-provider">Servico de IA</Label>
            <Select
              value={provedor}
              onValueChange={(value) => {
                form.setValue("provedor", value as AIProvider, {
                  shouldValidate: true,
                });
              }}
            >
              <SelectTrigger id="summary-provider">
                <SelectValue placeholder="Selecione um servico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary-model">Modelo</Label>
            {models.length > 0 ? (
              <Select
                value={modelo}
                onValueChange={(value) => {
                  form.setValue("modelo", value, { shouldValidate: true });
                }}
              >
                <SelectTrigger id="summary-model">
                  <SelectValue placeholder="Selecione uma opcao" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="summary-model" {...form.register("modelo")} />
            )}
            {form.formState.errors.modelo ? (
              <p className="text-sm font-medium text-red-600">
                {form.formState.errors.modelo.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary-api-key">Chave de acesso</Label>
            <Input
              id="summary-api-key"
              placeholder="Preencha apenas se o servico escolhido pedir essa chave"
              type="password"
              {...form.register("apiKey")}
            />
          </div>

          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
            <Button
              disabled={isLoadingModels}
              type="button"
              variant="outline"
              onClick={() => {
                void handleLoadModels();
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              {isLoadingModels ? "Atualizando opcoes..." : "Atualizar opcoes"}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Gerando resumo..." : "Gerar resumo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}