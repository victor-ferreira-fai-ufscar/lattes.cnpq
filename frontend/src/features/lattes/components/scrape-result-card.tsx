import { Download, FileText, TimerReset } from "lucide-react";

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
import type { ScrapeResponse } from "@/features/lattes/services/lattes.service";

type ScrapeResultCardProps = {
  result: ScrapeResponse;
};

export function ScrapeResultCard({ result }: ScrapeResultCardProps) {
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
          O curriculo foi localizado e preparado. Voce pode abrir o PDF abaixo.
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
        </div>
      </CardContent>
    </Card>
  );
}