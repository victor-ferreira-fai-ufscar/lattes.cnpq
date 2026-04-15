import { ChevronDown, Download, FileText, FolderOpen } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CurriculoDiffCard } from "@/features/lattes/components/curriculo-diff-card";
import { OUTPUT_FORMAT_LABELS } from "@/features/lattes/lib/output-format";
import type { ScrapeResponse } from "@/features/lattes/services/lattes.service";

type ScrapeResultCardProps = {
  result: ScrapeResponse;
};

export function ScrapeResultCard({ result }: ScrapeResultCardProps) {
  const generatedFiles = Array.isArray(result.generated_files)
    ? result.generated_files
    : [];

  const cacheLabel =
    result.cache_status === "hit"
      ? "Arquivo reaproveitado"
      : result.cache_status === "miss"
        ? "Arquivo atualizado agora"
        : "Origem não informada";

  const cacheClassName =
    result.cache_status === "hit"
      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
      : result.cache_status === "miss"
        ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
        : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700";

  const cacheTooltipMessage =
    result.cache_status === "hit"
      ? "O PDF já estava disponível e pôde ser reaproveitado sem nova coleta."
      : result.cache_status === "miss"
        ? "O PDF precisou ser gerado novamente porque não havia uma versão válida salva."
        : "A origem do arquivo não foi informada pela API.";

  return (
    <Card variant="successSubtle">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg text-emerald-950">
            Currículo pronto para uso
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cacheClassName}>{cacheLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="left">{cacheTooltipMessage}</TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          O currículo foi localizado e preparado. Você já pode abrir o PDF ou
          baixar os arquivos gerados no formato escolhido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetricCard label="Pessoa encontrada" value={result.nome} />
          <CompactMetricCard
            label="Última atualização"
            value={result.ultima_atualizacao_curriculo}
          />
          <CompactMetricCard label="Arquivo" value={result.arquivo_pdf} />
          <CompactMetricCard
            label="Duracao"
            value={`${result.duracao_segundos ?? 0} s`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            href={result.download_pdf_url}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Abrir PDF
          </a>
          {result.zip_download_url ? (
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
              href={result.zip_download_url}
              rel="noreferrer"
              target="_blank"
            >
              <Download className="h-4 w-4" />
              Baixar pacote ZIP
            </a>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
            <FolderOpen className="h-3.5 w-3.5" />
            Arquivos gerados
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {generatedFiles.map((file) => (
              <a
                key={file.relative_path}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
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

        {result.cache_historico_total_versoes !== undefined && (
          <CurriculoDiffCard
            totalVersoes={result.cache_historico_total_versoes}
            primeiraVersao={result.cache_historico_primeira_versao}
            ultimaVersao={result.cache_historico_ultima_versao}
            diff={result.cache_historico_diff}
          />
        )}

        <details className="group rounded-2xl border border-white/70 bg-white/75 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-700" />
              Ver detalhes do pacote
            </span>
            <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pasta visível
              </p>
              <p className="mt-2 break-words font-medium text-slate-900">
                {result.output_label ?? result.output_directory}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Storage
              </p>
              <p className="mt-2 break-all text-slate-700">{result.output_directory}</p>
            </div>
            {result.template_name ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Template DOCX
                </p>
                <p className="mt-2 break-words text-slate-700">{result.template_name}</p>
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function CompactMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {label}
      </p>
      <p className="mt-2 line-clamp-3 break-words text-sm font-semibold text-slate-950 sm:text-base">
        {value}
      </p>
    </div>
  );
}