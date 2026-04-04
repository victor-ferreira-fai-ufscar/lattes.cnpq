import { Download, FileText, FolderOpen, TimerReset } from "lucide-react";

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
      ? "Cache reutilizado"
      : result.cache_status === "miss"
        ? "Atualizado via scraping"
        : "Origem nao informada";

  const cacheClassName =
    result.cache_status === "hit"
      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
      : result.cache_status === "miss"
        ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
        : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700";

  const cacheTooltipMessage =
    result.cache_status === "hit"
      ? "PDF reaproveitado do Supabase Storage porque estava dentro da validade configurada."
      : result.cache_status === "miss"
        ? "PDF gerado novamente via scraping porque nao havia cache valido no Storage."
        : "Origem nao foi informada pela API.";

  return (
    <Card variant="successSubtle">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg text-emerald-950">
            Curriculo pronto para leitura
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cacheClassName}>{cacheLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="left">{cacheTooltipMessage}</TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          O curriculo foi localizado e preparado. O PDF continua disponivel e os
          arquivos solicitados foram salvos no Supabase Storage e empacotados para download.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Pessoa encontrada
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">{result.nome}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Ultima atualizacao informada
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {result.ultima_atualizacao_curriculo}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/60 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-emerald-700" />
            {result.arquivo_pdf}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <TimerReset className="h-4 w-4 text-emerald-700" />
            {result.duracao_segundos ?? 0} s
          </div>
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4"
            href={result.download_pdf_url}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            Abrir PDF
          </a>
          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              <FolderOpen className="h-3.5 w-3.5" />
              Arquivos gerados
            </div>
            <p className="text-xs text-slate-600">
              Pasta: {result.output_label ?? result.output_directory}
            </p>
            <p className="text-xs text-slate-500">Storage: {result.output_directory}</p>
            {result.template_name ? (
              <p className="text-xs text-slate-600">Template DOCX: {result.template_name}</p>
            ) : null}
            {result.zip_download_url ? (
              <a
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 underline decoration-emerald-300 underline-offset-4"
                href={result.zip_download_url}
                rel="noreferrer"
                target="_blank"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar pacote ZIP
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {generatedFiles.map((file) => (
                <a
                  key={file.relative_path}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
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
      </CardContent>
    </Card>
  );
}