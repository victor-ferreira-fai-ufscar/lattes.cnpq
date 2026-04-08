"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BrainCircuit, CheckCircle2, RefreshCcw, Server } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  disabled: boolean;
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
  disabled,
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
  const apiKey = useWatch({
    control: form.control,
    name: "apiKey",
  });

  useEffect(() => {
    const storedKey = storedApiKeys[provedor] ?? "";
    form.setValue("apiKey", storedKey, { shouldValidate: false });
  }, [provedor, form, storedApiKeys]);

  const isOllama = provedor === "ollama";
  const hasStoredKeyForProvider = !isOllama && Boolean(storedApiKeys[provedor]);
  const hasProviderSetup = isOllama || Boolean(apiKey || hasStoredKeyForProvider);

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
            na leitura rápida do currículo. Essa etapa é opcional.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900 md:col-span-2">
              Use este recurso apenas se quiser um resumo pronto para leitura. O currículo original e os arquivos gerados continuam disponíveis mesmo sem IA.
            </div>
            <FormField
              control={form.control}
              name="provedor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço de IA</FormLabel>
                  <Select
                    disabled={disabled}
                    value={field.value}
                    onValueChange={(value) => {
                      const nextProvider = value as AIProvider;
                      field.onChange(nextProvider);
                      onConfigChange({ provedor: nextProvider });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Escolha de onde o resumo será gerado.
                  </p>
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
                      disabled={disabled}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onConfigChange({ modelo: value });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma opção" />
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
                        disabled={disabled}
                        placeholder="Digite o nome do modelo"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onConfigChange({ modelo: event.target.value });
                        }}
                      />
                    </FormControl>
                  )}
                  <p className="text-xs text-slate-500">
                    {models.length > 0
                      ? "Escolha um dos modelos disponíveis para o serviço selecionado."
                      : "Se a lista estiver vazia, carregue as opções ou informe o modelo manualmente."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isOllama && (
              <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">Uso local</span> — O Ollama precisa estar em
                  execução na mesma máquina que o backend. Se estiver usando Docker Compose,
                  adicione um serviço <code className="font-mono">ollama</code> e configure{" "}
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
                          disabled={disabled}
                          className="text-xs text-slate-400 transition-colors hover:text-slate-600"
                          onClick={handleClearApiKey}
                        >
                          Limpar
                        </button>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={disabled}
                        placeholder={API_KEY_PLACEHOLDER[provedor]}
                        type="password"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onConfigChange({ apiKey: event.target.value });
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-slate-500">
                      Informe a chave apenas se quiser usar este serviço de IA nesta etapa.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
              <Button
                disabled={disabled || isLoadingModels}
                type="button"
                variant="outline"
                onClick={() => {
                  void handleLoadModels();
                }}
              >
                {isLoadingModels ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {isLoadingModels ? "Carregando modelos..." : "Carregar modelos"}
              </Button>
              <Button disabled={disabled || isSubmitting || !hasProviderSetup} type="submit">
                {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
                {isSubmitting ? "Gerando resumo..." : "Gerar resumo"}
              </Button>
            </div>
            {!hasProviderSetup ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 md:col-span-2">
                Para gerar o resumo, selecione um serviço e informe a chave de acesso, exceto no uso com Ollama.
              </div>
            ) : null}
            {isLoadingModels || isSubmitting ? (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900 md:col-span-2">
                {isLoadingModels
                  ? "Consultando os modelos disponíveis para o serviço selecionado."
                  : "A IA está analisando o currículo e preparando o resumo final."}
              </div>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}