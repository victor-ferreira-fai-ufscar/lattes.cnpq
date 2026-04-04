"use client";

import { useState } from "react";
import { Download, FileArchive, FolderTree, TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const locator = item.erro_locator || "(nao informado)";

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
      title: "Nome nao encontrado na busca",
      probableCause:
        "O nome enviado nao retornou candidatos no Lattes neste formato. Diferencas de acento, grafia ou composicao do nome podem impactar o resultado.",
      evidence: [
        `Nome enviado: ${item.nome}`,
        "A API retornou sinal de nenhum resultado para este nome apos tentar variacoes automaticas de busca.",
      ],
      suggestedAction:
        "Tentar variacoes do nome (sem acento e nome parcial) e, se houver homonimos, usar a busca individual para selecionar o candidato correto.",
      quickChecks: variants.slice(0, 5),
    };
  }

  if (isTimeout && isInvisibleElement && isClickFailure) {
    return {
      category: "timeout-sincronizacao",
      confidence: "alta",
      title: "Falha de sincronizacao da interface",
      probableCause:
        "O script tentou clicar em um elemento que existe no DOM, mas permaneceu invisivel ate o timeout.",
      evidence: [
        `Tipo de erro: ${item.erro_tipo ?? "TimeoutError"}`,
        `Locator afetado: ${locator}`,
        "Log indica repetidas tentativas de click com elemento invisivel.",
      ],
      suggestedAction:
        "Validar se o modal/painel correto realmente abriu antes do click e trocar a espera para visibilidade explicita do elemento clicavel.",
      quickChecks: [
        "Conferir se o locator esta especifico o suficiente (evitar seletor generico como 'a').",
        "Esperar explicitamente o elemento ficar visivel antes do click.",
        "Garantir que nenhum overlay/modal esteja bloqueando a interacao.",
      ],
    };
  }

  if (isTimeout) {
    return {
      category: "timeout",
      confidence: "media",
      title: "Timeout durante automacao",
      probableCause:
        "A etapa demorou mais do que o limite configurado para a condicao esperada.",
      evidence: [
        `Timeout configurado: ${item.erro_timeout_ms ?? "nao informado"}ms`,
        `Locator afetado: ${locator}`,
      ],
      suggestedAction:
        "Revisar se ha variacao de carregamento na pagina e aguardar uma condicao mais estavel (rede ociosa, elemento visivel ou estado da tela).",
      quickChecks: [
        "Aumentar timeout apenas depois de validar condicao de espera correta.",
        "Checar se houve redirecionamento ou captcha durante a execucao.",
      ],
    };
  }

  return {
    category: "generico",
    confidence: "baixa",
    title: "Erro nao classificado automaticamente",
    probableCause:
      "Nao foi possivel inferir uma causa unica a partir do padrao conhecido deste erro.",
    evidence: [
      `Tipo de erro: ${item.erro_tipo ?? "nao informado"}`,
      `Locator afetado: ${locator}`,
    ],
    suggestedAction:
      "Usar os detalhes tecnicos para reproduzir o problema e ajustar a etapa correspondente do scraping.",
    quickChecks: [
      "Executar novamente com logs detalhados para comparar comportamento.",
      "Validar se a pagina de destino mudou estrutura recentemente.",
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
          arquivos disponiveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Arquivo enviado" value={result.arquivo} />
          <Metric
            label="Formato"
            value={OUTPUT_FORMAT_LABELS[result.output_format] ?? result.output_format}
          />
          <Metric label="Pessoas processadas" value={String(result.total_processados)} />
          <Metric label="Concluidos" value={String(result.sucesso)} />
          <Metric label="Com problema" value={String(result.erro)} />
          {typeof result.cache_hits === "number" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Metric label="Cache hit" value={String(result.cache_hits)} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Quantidade de PDFs reaproveitados do Storage sem novo scraping.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {typeof result.cache_misses === "number" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Metric label="Scraping" value={String(result.cache_misses)} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Quantidade de casos em que foi necessario gerar o PDF novamente via scraping.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {result.zip_download_url ? (
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-4"
            href={result.zip_download_url}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Baixar todos os arquivos gerados
          </a>
        ) : result.zip_erro ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {result.zip_erro}
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <FolderTree className="h-4 w-4 shrink-0" />
          Pasta do lote: {result.output_label ?? result.output_directory}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileArchive className="h-4 w-4 text-amber-700" />
            Resultado por pessoa
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {result.resultados.map((item, index) => (
              <div
                key={`${item.nome}-${item.status}-${index}`}
                className="rounded-xl border border-white/70 bg-white/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{item.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.duracao_segundos} s
                    </p>
                    {item.status === "sucesso" && item.cache_status ? (
                      <p className="mt-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={
                                item.cache_status === "hit"
                                  ? "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800"
                                  : "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800"
                              }
                            >
                              {item.cache_status === "hit"
                                ? "Origem: Cache"
                                : "Origem: Scraping"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.cache_status === "hit"
                              ? "PDF reaproveitado do Storage dentro da janela de validade."
                              : "Sem cache valido: PDF gerado novamente via scraping."}
                          </TooltipContent>
                        </Tooltip>
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      item.status === "sucesso"
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                        : "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800"
                    }
                  >
                    {item.status === "sucesso" ? "Concluido" : "Erro"}
                  </span>
                </div>
                {item.status === "sucesso" ? (
                  <div className="mt-3 space-y-3">
                    <a
                      className="inline-flex text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-4"
                      href={item.download_pdf_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir PDF original
                    </a>
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
                          Template DOCX: {item.template_name}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Array.isArray(item.generated_files)
                          ? item.generated_files
                          : []
                        ).map((file) => (
                          <a
                            key={file.relative_path}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
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
                              Diagnostico automatico
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${confidenceBadgeStyle(diagnosis.confidence)}`}
                            >
                              Confianca {diagnosis.confidence}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-red-900">
                            {diagnosis.title}
                          </p>
                          <p className="mt-1 leading-relaxed">
                            <span className="font-semibold">Causa provavel:</span>{" "}
                            {diagnosis.probableCause}
                          </p>
                          <div className="mt-2 space-y-1 leading-relaxed">
                            {diagnosis.evidence.map((line) => (
                              <p key={line}>- {line}</p>
                            ))}
                          </div>
                          <p className="mt-2 leading-relaxed">
                            <span className="font-semibold">Acao sugerida:</span>{" "}
                            {diagnosis.suggestedAction}
                          </p>
                          {diagnosis.quickChecks.length > 0 ? (
                            <div className="mt-2 space-y-1 leading-relaxed">
                              <p className="font-semibold">Testes rapidos:</p>
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
                          Detalhes tecnicos
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
              </div>
            ))}
          </div>
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
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}