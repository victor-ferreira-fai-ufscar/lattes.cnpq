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
    <Card className="border-cyan-200/70 bg-cyan-50/70">
      <CardHeader>
        <CardTitle className="text-lg text-cyan-950">Resumo gerado</CardTitle>
        <CardDescription>
          A resposta de IA é apresentada em um componente próprio, desacoplado
          do fluxo de busca e scraping.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Docente
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