"use client";

import { useState } from "react";
import {
  ChevronDown,
  Download,
  FileArchive,
  FolderTree,
  TriangleAlert,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildNameVariants } from "@/features/lattes/lib/name-variants";
import { OUTPUT_FORMAT_LABELS } from "@/features/lattes/lib/output-format";
import type {
  BatchItemError,
  BatchScrapeResponse,
} from "@/features/lattes/services/lattes.service";

type BatchResultCardProps = {
  result: BatchScrapeResponse;
};

type BatchErrorDiagnosis = {
  category: "nome-nao-encontrado" | "timeout-sincronizacao" | "timeout" | "generico";
  confidence: "alta" | "media" | "baixa";
  title: string;
  probableCause: string;
  evidence: string[];
  suggestedAction: string;
  quickChecks: string[];
};

function normalizeText(text?: string | null) {
  return (text ?? "").toLowerCase();
}

function diagnoseBatchError(item: BatchItemError): BatchErrorDiagnosis {
  const errorText = normalizeText(item.erro);
  const detailText = normalizeText(item.erro_detalhe);
  const locator = item.erro_locator || "(não informado)";

  const isTimeout =
    item.erro_tipo === "TimeoutError" ||
    errorText.includes("timeout") ||
    detailText.includes("timeout");
  const isNotFound =
    errorText.includes("nenhum resultado") ||
    errorText.includes("nao encontrado") ||
    errorText.includes("não encontrado") ||
    detailText.includes("nenhum resultado") ||
    detailText.includes("nao encontrado") ||
    detailText.includes("não encontrado");
  const isInvisibleElement =
    detailText.includes("element is not visible") ||
    detailText.includes("not visible");
  const isClickFailure =
    detailText.includes("click") || errorText.includes("interagir com locator");

  if (isNotFound) {
    const variants = buildNameVariants(item.nome);
    return {
      category: "nome-nao-encontrado",
      confidence: "alta",
      title: "Não encontramos esse nome na busca",
      probableCause:
        "O nome enviado não retornou candidatos no Lattes neste formato. Diferenças de acento, grafia ou composição do nome podem impactar o resultado.",
      evidence: [
        `Nome enviado: ${item.nome}`,
        "A busca não encontrou resultados mesmo após tentar variações automáticas do nome.",
      ],
      suggestedAction:
        "Tente variações do nome, como uma versão sem acento ou mais curta. Se houver homônimos, use a busca individual para escolher a pessoa correta.",
      quickChecks: variants.slice(0, 5),
    };
  }

  if (isTimeout && isInvisibleElement && isClickFailure) {
    return {
      category: "timeout-sincronizacao",
      confidence: "alta",
      title: "A página não respondeu como esperado",
      probableCause:
        "A página demorou para liberar a próxima etapa e o processamento atingiu o tempo limite.",
      evidence: [
        `Tipo de erro: ${item.erro_tipo ?? "TimeoutError"}`,
        `Elemento afetado: ${locator}`,
        "Os registros indicam tentativas repetidas de interação sem resposta visível da página.",
      ],
      suggestedAction:
        "Tente novamente em alguns instantes. Se o problema continuar, execute de novo com menos nomes por vez ou revise os detalhes técnicos abaixo.",
      quickChecks: [
        "Tentar novamente daqui a pouco.",
        "Reduzir a quantidade de nomes processados de uma vez.",
        "Usar a busca individual se o problema acontecer sempre com a mesma pessoa.",
      ],
    };
  }

  if (isTimeout) {
    return {
      category: "timeout",
      confidence: "media",
      title: "O processamento demorou mais do que o esperado",
      probableCause:
        "Uma das etapas da coleta levou mais tempo do que o limite configurado.",
      evidence: [
        `Tempo limite configurado: ${item.erro_timeout_ms ?? "não informado"}ms`,
        `Elemento afetado: ${locator}`,
      ],
      suggestedAction:
        "Tente novamente. Se estiver processando uma lista grande, vale reduzir a quantidade de nomes para facilitar a execução.",
      quickChecks: [
        "Repetir a tentativa com menos nomes por vez.",
        "Verificar se houve lentidão temporária no site do Lattes.",
      ],
    };
  }

  return {
    category: "generico",
    confidence: "baixa",
    title: "Não foi possível classificar o problema automaticamente",
    probableCause:
      "Não foi possível identificar uma causa única com base nos padrões já conhecidos.",
    evidence: [
      `Tipo de erro: ${item.erro_tipo ?? "não informado"}`,
      `Elemento afetado: ${locator}`,
    ],
    suggestedAction:
      "Tente novamente. Se o erro persistir, use os detalhes técnicos para investigar o caso específico.",
    quickChecks: [
      "Executar novamente para confirmar se foi uma falha momentânea.",
      "Usar a busca individual se quiser isolar um único nome.",
    ],
  };
}

function confidenceBadgeStyle(confidence: BatchErrorDiagnosis["confidence"]) {
  if (confidence === "alta") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (confidence === "media") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-200 text-slate-700";
}

export function BatchResultCard({ result }: BatchResultCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const hasErrors = result.erro > 0;

  const handleCopyDebug = async (key: string, payload: Record<string, unknown>) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <Card variant="warningSubtle">
      <CardHeader>
        <CardTitle className="text-lg text-amber-950">Lista processada</CardTitle>
        <CardDescription>
          Sua lista foi processada. Confira abaixo o total de resultados e os
          arquivos disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
          <p className="font-semibold">
            {hasErrors
              ? `A lista terminou com ${result.sucesso} resultado(s) concluído(s) e ${result.erro} com problema.`
              : `Tudo certo: ${result.sucesso} resultado(s) foram concluído(s) sem problemas.`}
          </p>
          <p className="mt-1 text-amber-900/80">
            Comece pelo download do lote e abra os detalhes apenas se quiser revisar cada pessoa.
          </p>
        </div>

        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          <Metric label="Arquivo enviado" value={result.arquivo} />
          <Metric label="Pessoas processadas" value={String(result.total_processados)} />
          <Metric label="Concluídos" value={String(result.sucesso)} />
          <Metric label="Com problema" value={String(result.erro)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Formato escolhido"
            value={OUTPUT_FORMAT_LABELS[result.output_format] ?? result.output_format}
          />
          {typeof result.cache_hits === "number" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Metric label="Arquivo já salvo" value={String(result.cache_hits)} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Quantidade de PDFs reaproveitados sem precisar gerar tudo de novo.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {typeof result.cache_misses === "number" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Metric label="Gerado agora" value={String(result.cache_misses)} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Quantidade de casos em que foi necessário gerar o PDF novamente.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {result.zip_download_url ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              href={result.zip_download_url}
              rel="noreferrer"
              target="_blank"
            >
              <Download className="h-4 w-4" />
              Baixar todos os arquivos
            </a>
          ) : result.zip_erro ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {result.zip_erro}
            </div>
          ) : null}

          <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 sm:justify-center">
            <FolderTree className="h-4 w-4 shrink-0" />
            <span className="line-clamp-2 break-words">
              Pasta do lote: {result.output_label ?? result.output_directory}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileArchive className="h-4 w-4 text-amber-700" />
            Resultado por pessoa
          </div>
          <ScrollArea className="max-h-80 rounded-2xl">
            <div className="space-y-2 pr-3">
              {result.resultados.map((item, index) => (
              <details
                key={`${item.nome}-${item.status}-${index}`}
                className="group rounded-2xl border border-white/70 bg-white/75 p-4"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-950">{item.nome}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                        {item.duracao_segundos} s
                      </span>
                      {item.status === "sucesso" && item.cache_status ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={
                                item.cache_status === "hit"
                                  ? "rounded-full bg-emerald-100 px-2.5 py-1 font-semibold uppercase tracking-[0.08em] text-emerald-800"
                                  : "rounded-full bg-amber-100 px-2.5 py-1 font-semibold uppercase tracking-[0.08em] text-amber-800"
                              }
                            >
                              {item.cache_status === "hit" ? "Já disponível" : "Gerado agora"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.cache_status === "hit"
                              ? "O PDF já estava salvo e foi reaproveitado."
                              : "O PDF precisou ser gerado novamente neste processamento."}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        item.status === "sucesso"
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                          : "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800"
                      }
                    >
                      {item.status === "sucesso" ? "Concluído" : "Erro"}
                    </span>
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
                  </div>
                </summary>
                {item.status === "sucesso" ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <a
                        className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                        href={item.download_pdf_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir PDF original
                      </a>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                        Arquivos gerados
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Pasta: {item.output_label ?? item.output_directory}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Storage: {item.output_directory}</p>
                      {item.template_name ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Modelo DOCX: {item.template_name}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Array.isArray(item.generated_files)
                          ? item.generated_files
                          : []
                        ).map((file) => (
                          <a
                            key={file.relative_path}
                            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                            href={file.download_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {OUTPUT_FORMAT_LABELS[file.format as keyof typeof OUTPUT_FORMAT_LABELS] ?? file.format.toUpperCase()}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-red-700">
                    <p>{item.erro}</p>
                    {(() => {
                      const diagnosis = diagnoseBatchError(item);
                      return (
                        <div className="rounded-lg border border-red-200 bg-white/70 p-3 text-xs text-red-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold uppercase tracking-[0.1em] text-red-800">
                              O que pode ter acontecido
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${confidenceBadgeStyle(diagnosis.confidence)}`}
                            >
                              Confiança {diagnosis.confidence}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-red-900">
                            {diagnosis.title}
                          </p>
                          <p className="mt-1 leading-relaxed">
                            <span className="font-semibold">Causa provável:</span>{" "}
                            {diagnosis.probableCause}
                          </p>
                          <div className="mt-2 space-y-1 leading-relaxed">
                            {diagnosis.evidence.map((line) => (
                              <p key={line}>- {line}</p>
                            ))}
                          </div>
                          <p className="mt-2 leading-relaxed">
                            <span className="font-semibold">O que fazer agora:</span>{" "}
                            {diagnosis.suggestedAction}
                          </p>
                          {diagnosis.quickChecks.length > 0 ? (
                            <div className="mt-2 space-y-1 leading-relaxed">
                              <p className="font-semibold">Sugestões rápidas:</p>
                              {diagnosis.quickChecks.map((line) => (
                                <p key={line}>- {line}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    {(item.erro_detalhe || item.erro_tipo || item.erro_timeout_ms || item.erro_locator) && (
                      <details className="rounded-lg border border-red-200/80 bg-red-50/50 p-2">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-red-800">
                          Detalhes técnicos
                        </summary>
                        <div className="mt-2 space-y-1 text-xs text-red-900">
                          {item.erro_tipo && <p>Tipo: {item.erro_tipo}</p>}
                          {typeof item.erro_timeout_ms === "number" && (
                            <p>Timeout: {item.erro_timeout_ms}ms</p>
                          )}
                          {item.erro_locator && <p>Locator: {item.erro_locator}</p>}
                          {item.erro_detalhe && <p>Mensagem completa: {item.erro_detalhe}</p>}

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 h-auto border-red-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-800 hover:bg-red-100 hover:text-red-900"
                            onClick={() =>
                              handleCopyDebug(`${item.nome}-${index}`, {
                                nome: item.nome,
                                erro: item.erro,
                                erro_tipo: item.erro_tipo,
                                erro_timeout_ms: item.erro_timeout_ms,
                                erro_locator: item.erro_locator,
                                erro_detalhe: item.erro_detalhe,
                                duracao_segundos: item.duracao_segundos,
                              })
                            }
                          >
                            {copiedKey === `${item.nome}-${index}`
                              ? "Copiado"
                              : "Copiar detalhes"}
                          </Button>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </details>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        {label}
      </p>
      <p className="mt-2 line-clamp-3 break-words text-base font-semibold text-slate-950 sm:text-lg">{value}</p>
    </div>
  );
}