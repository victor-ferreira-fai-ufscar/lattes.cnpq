import { Download, FileText, TimerReset } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScrapeResponse } from "@/features/lattes/services/lattes.service";

type ScrapeResultCardProps = {
  result: ScrapeResponse;
};

export function ScrapeResultCard({ result }: ScrapeResultCardProps) {
  return (
    <Card variant="successSubtle">
      <CardHeader>
        <CardTitle className="text-lg text-emerald-950">
          Curriculo pronto para leitura
        </CardTitle>
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