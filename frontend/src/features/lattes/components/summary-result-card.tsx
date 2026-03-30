import ReactMarkdown from "react-markdown";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SummarizeResponse } from "@/features/lattes/services/lattes.service";

type SummaryResultCardProps = {
  result: SummarizeResponse;
};

export function SummaryResultCard({ result }: SummaryResultCardProps) {
  return (
    <Card variant="infoSubtle">
      <CardHeader>
        <CardTitle className="text-lg text-cyan-950">Resumo gerado</CardTitle>
        <CardDescription>
          Texto resumido para leitura mais rapida do curriculo selecionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Pessoa
          </p>
          <p className="mt-1 text-base font-semibold text-slate-950">{result.nome}</p>
        </div>
        <article className="prose prose-slate max-w-none rounded-2xl border border-white/70 bg-white/80 p-5 prose-headings:text-slate-950 prose-p:text-slate-700 prose-strong:text-slate-950">
          <ReactMarkdown>{result.resumo}</ReactMarkdown>
        </article>
      </CardContent>
    </Card>
  );
}