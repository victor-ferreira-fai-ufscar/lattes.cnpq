"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BrainCircuit, CheckCircle2, RefreshCcw, Server } from "lucide-react";
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
import {
  Form,
  FormControl,
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
  SummarySchema,
  type SummaryFormData,
} from "@/features/lattes/schemas/lattes.schemas";
import type { AIProvider } from "@/features/lattes/services/lattes.service";
import type { StoredApiKeys } from "@/features/lattes/stores/lattes-summary-store";

const API_KEY_PLACEHOLDER: Record<AIProvider, string> = {
  openai: "Sua chave da API OpenAI (sk-...)",
  gemini: "Sua chave da API Gemini (AIza...)",
  ollama: "",
};

type SummaryPanelProps = {
  defaultValues: SummaryFormData;
  storedApiKeys: StoredApiKeys;
  models: string[];
  isLoadingModels: boolean;
  isSubmitting: boolean;
  onConfigChange: (patch: Partial<SummaryFormData>) => void;
  onLoadModels: (values: {
    provedor: AIProvider;
    apiKey?: string;
  }) => Promise<void>;
  onSubmitSummary: (values: SummaryFormData) => Promise<void>;
};

export function SummaryPanel({
  defaultValues,
  storedApiKeys,
  models,
  isLoadingModels,
  isSubmitting,
  onConfigChange,
  onLoadModels,
  onSubmitSummary,
}: SummaryPanelProps) {
  const form = useForm<SummaryFormData>({
    resolver: zodResolver(SummarySchema),
    defaultValues,
  });

  useEffect(() => {
    const currentValues = form.getValues();

    if (
      currentValues.provedor === defaultValues.provedor &&
      currentValues.modelo === defaultValues.modelo &&
      currentValues.apiKey === defaultValues.apiKey
    ) {
      return;
    }

    form.reset(defaultValues);
  }, [defaultValues, form]);

  const provedor = useWatch({
    control: form.control,
    name: "provedor",
  });

  useEffect(() => {
    const storedKey = storedApiKeys[provedor] ?? "";
    form.setValue("apiKey", storedKey, { shouldValidate: false });
  }, [provedor, form, storedApiKeys]);

  const isOllama = provedor === "ollama";
  const hasStoredKeyForProvider = !isOllama && Boolean(storedApiKeys[provedor]);

  const handleClearApiKey = () => {
    form.setValue("apiKey", "", { shouldValidate: false });
    onConfigChange({ apiKey: "" });
  };

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
    <Card variant="panel">
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
        <Form {...form}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="provedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servico de IA</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      const nextProvider = value as AIProvider;
                      field.onChange(nextProvider);
                      onConfigChange({ provedor: nextProvider });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um servico" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  {models.length > 0 ? (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onConfigChange({ modelo: value });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma opcao" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onConfigChange({ modelo: event.target.value });
                        }}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {isOllama && (
              <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">Apenas local</span> — O Ollama precisa estar
                  em execução na mesma máquina que o backend. Ao usar via docker-compose, adicione
                  um serviço <code className="font-mono">ollama</code> e configure{" "}
                  <code className="font-mono">OLLAMA_BASE_URL</code> no backend. Não é necessária
                  chave de API.
                </span>
              </div>
            )}

            {!isOllama && (
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        Chave de acesso
                        {hasStoredKeyForProvider && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Salva
                          </span>
                        )}
                      </span>
                      {hasStoredKeyForProvider && (
                        <button
                          type="button"
                          className="text-xs text-slate-400 transition-colors hover:text-slate-600"
                          onClick={handleClearApiKey}
                        >
                          Limpar
                        </button>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={API_KEY_PLACEHOLDER[provedor]}
                        type="password"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onConfigChange({ apiKey: event.target.value });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
        </Form>
      </CardContent>
    </Card>
  );
}