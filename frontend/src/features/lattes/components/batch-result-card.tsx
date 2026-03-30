"use client";

import { useState } from "react";
import { Download, FileArchive, TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BatchScrapeResponse } from "@/features/lattes/services/lattes.service";

type BatchResultCardProps = {
  result: BatchScrapeResponse;
};

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
          <Metric label="Pessoas processadas" value={String(result.total_processados)} />
          <Metric label="Concluidos" value={String(result.sucesso)} />
          <Metric label="Com problema" value={String(result.erro)} />
        </div>

        {result.zip_download_url ? (
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-4"
            href={result.zip_download_url}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Baixar todos os PDFs
          </a>
        ) : result.zip_erro ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {result.zip_erro}
          </div>
        ) : null}

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
                  <a
                    className="mt-3 inline-flex text-sm font-medium text-amber-900 underline decoration-amber-400 underline-offset-4"
                    href={item.download_pdf_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir PDF
                  </a>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-red-700">
                    <p>{item.erro}</p>

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