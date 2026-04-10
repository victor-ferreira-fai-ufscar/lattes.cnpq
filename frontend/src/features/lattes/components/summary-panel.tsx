"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BrainCircuit, CheckCircle2, RefreshCcw, Server } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";

const API_KEY_PLACEHOLDER: Record<AIProvider, string> = {
  openai: "Sua chave da API OpenAI (sk-...)",
  gemini: "Sua chave da API Gemini (AIza...)",
  ollama: "",
};

const OLLAMA_LOCAL_SETUP_MARKDOWN = `### Para usar o Ollama, rode tudo localmente

O Ollama **não funciona quando o backend está hospedado na web**. Para usar esta opção, o projeto e o Ollama precisam estar rodando na sua máquina.

Passo a passo:

1. Faça o git clone deste repositório: [github.com/victor-ferreira-fai-ufscar/lattes.cnpq](https://github.com/victor-ferreira-fai-ufscar/lattes.cnpq).
2. No backend, copie o arquivo \`backend/.env.example\` para \`backend/.env\`.
3. Nesse arquivo, você pode manter o valor padrão de \`OLLAMA_BASE_URL\`, que já funciona no fluxo local com Docker Compose.
4. Instale e abra o Ollama no mesmo computador: [ollama.com/download](https://ollama.com/download).
5. Para começar com um modelo mais leve, uma opção é o [Gemma 4 E2B](https://ollama.com/library/gemma4), pensado para uso local em máquinas mais comuns.
6. Depois disso, rode o projeto localmente com Docker Compose.

#### O que já vem no backend/.env.example

\`\`\`env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1
\`\`\`

Se quiser, você pode trocar o modelo padrão por um mais leve para testes, por exemplo:

\`\`\`env
OLLAMA_MODEL=gemma4:e2b
\`\`\`

#### Exemplo do backend no Docker Compose

\`\`\`yaml
backend:
  env_file:
    - .env.docker
    - path: ./backend/.env
      required: false
  extra_hosts:
    - "host.docker.internal:host-gateway"
\`\`\`

#### Exemplo para baixar ou abrir o modelo no Ollama

\`\`\`bash
ollama run gemma4:e2b
\`\`\`
`;

const markdownComponents = {
  h3: ({ className, ...props }: React.ComponentProps<"h3">) => (
    <h3 className={cn("mt-2 text-lg font-semibold text-slate-950 first:mt-0", className)} {...props} />
  ),
  h4: ({ className, ...props }: React.ComponentProps<"h4">) => (
    <h4 className={cn("mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-800", className)} {...props} />
  ),
  p: ({ className, ...props }: React.ComponentProps<"p">) => (
    <p className={cn("my-4 text-sm leading-7 text-slate-700 sm:text-[15px]", className)} {...props} />
  ),
  ol: ({ className, ...props }: React.ComponentProps<"ol">) => (
    <ol className={cn("my-4 list-decimal space-y-2 pl-6 text-sm leading-7 text-slate-700 sm:text-[15px]", className)} {...props} />
  ),
  ul: ({ className, ...props }: React.ComponentProps<"ul">) => (
    <ul className={cn("my-4 list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700 sm:text-[15px]", className)} {...props} />
  ),
  li: ({ className, ...props }: React.ComponentProps<"li">) => (
    <li className={cn("pl-1 marker:font-semibold marker:text-cyan-700", className)} {...props} />
  ),
  a: ({ className, ...props }: React.ComponentProps<"a">) => (
    <a
      className={cn(
        "font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-800",
        className,
      )}
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote
      className={cn(
        "my-5 rounded-r-2xl border-l-4 border-cyan-500 bg-cyan-50/70 px-4 py-3 text-sm italic leading-7 text-slate-700 sm:text-[15px]",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }: React.ComponentProps<"pre">) => (
    <pre
      className={cn(
        "my-5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-100",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }: React.ComponentProps<"code">) => {
    const isBlockCode = Boolean(className);

    return (
      <code
        className={cn(
          isBlockCode
            ? "font-mono text-[13px] text-slate-100"
            : "rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900",
          className,
        )}
        {...props}
      />
    );
  },
  strong: ({ className, ...props }: React.ComponentProps<"strong">) => (
    <strong className={cn("font-semibold text-slate-950", className)} {...props} />
  ),
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
              <Dialog>
                <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p>
                      <span className="font-semibold">Uso local</span> - O Ollama só funciona
                      se o projeto estiver rodando localmente na sua máquina, com o Ollama
                      aberto no mesmo computador. Baixe em{" "}
                      <a
                        className="font-medium underline decoration-amber-300 underline-offset-4 transition hover:text-amber-900"
                        href="https://ollama.com/download"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ollama.com/download
                      </a>
                      . Não é necessária chave de API.
                    </p>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="mt-2 font-medium underline decoration-amber-300 underline-offset-4 transition hover:text-amber-900"
                      >
                        Fez git clone e vai rodar tudo localmente? Clique aqui para ver o passo a passo.
                      </button>
                    </DialogTrigger>
                  </div>
                </div>
                <DialogContent className="flex h-[min(90vh,760px)] min-h-0 flex-col overflow-hidden sm:max-w-3xl">
                  <DialogHeader className="border-b border-slate-200/80 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-7">
                    <DialogTitle>Como usar Ollama localmente</DialogTitle>
                    <DialogDescription>
                      Resumo rápido para quem fez git clone do projeto e vai testar tudo na própria máquina.
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="min-h-0 flex-1" type="always">
                    <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
                      <article className="rounded-[26px] border border-cyan-100/80 bg-gradient-to-br from-white/95 via-cyan-50/30 to-teal-50/50 p-4 shadow-[0_14px_40px_-30px_rgba(8,145,178,0.5)] sm:p-6">
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {OLLAMA_LOCAL_SETUP_MARKDOWN}
                        </ReactMarkdown>
                      </article>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
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