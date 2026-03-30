"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
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
  const [copied, setCopied] = useState(false);

  const cleanedMarkdown = useMemo(() => result.resumo.trim(), [result.resumo]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedMarkdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card variant="infoSubtle">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-lg text-cyan-950">Resumo gerado</CardTitle>
          <CardDescription>
            Texto resumido para leitura mais rapida do curriculo selecionado.
          </CardDescription>
        </div>
        <Button
          className="shrink-0"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            void handleCopy();
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar Markdown"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Pessoa
          </p>
          <p className="mt-1 text-base font-semibold text-slate-950">{result.nome}</p>
        </div>
        <article className="prose prose-slate max-w-none rounded-2xl border border-cyan-100/80 bg-gradient-to-br from-white/90 via-cyan-50/30 to-teal-50/50 p-5 shadow-[0_14px_40px_-30px_rgba(8,145,178,0.5)] prose-headings:font-heading prose-headings:text-slate-950 prose-p:leading-7 prose-p:text-slate-700 prose-strong:text-slate-950 prose-a:text-cyan-700 prose-a:no-underline hover:prose-a:text-cyan-800 hover:prose-a:underline prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-slate-900 prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-700 prose-li:marker:text-cyan-700">
          <ReactMarkdown>{cleanedMarkdown}</ReactMarkdown>
        </article>
      </CardContent>
    </Card>
  );
}