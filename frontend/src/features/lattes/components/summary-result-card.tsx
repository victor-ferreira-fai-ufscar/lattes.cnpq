"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SummarizeResponse } from "@/features/lattes/services/lattes.service";
import { cn } from "@/lib/utils";

type SummaryResultCardProps = {
  result: SummarizeResponse;
};

function extractMarkdownFromFence(content: string): string {
  const trimmed = content.trim();
  const fencedMarkdownMatch = trimmed.match(
    /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i,
  );

  if (fencedMarkdownMatch?.[1]) {
    return fencedMarkdownMatch[1].trim();
  }

  const firstFenceMatch = trimmed.match(/```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```/i);
  if (firstFenceMatch?.[1]) {
    return firstFenceMatch[1].trim();
  }

  return trimmed;
}

export function SummaryResultCard({ result }: SummaryResultCardProps) {
  const [copied, setCopied] = useState(false);

  const cleanedMarkdown = useMemo(
    () => extractMarkdownFromFence(result.resumo),
    [result.resumo],
  );

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
    <Dialog>
      <Card variant="infoSubtle">
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-lg text-cyan-950">Resumo executivo e detalhes</CardTitle>
              <CardDescription>
                Estruturado em Markdown e priorizando as informações extraídas do PDF do currículo.
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={copied ? "Markdown copiado" : "Copiar markdown"}
                  className="h-10 w-10 shrink-0 rounded-full border-slate-300 bg-white/90 px-0 text-slate-700 hover:bg-white"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void handleCopy();
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {copied ? "Markdown copiado" : "Copiar markdown"}
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryMetaCard icon={<FileText className="h-4 w-4" />} label="Pessoa" value={result.nome} />
            {result.fonte_resumo ? (
              <SummaryMetaCard
                icon={<Check className="h-4 w-4" />}
                label="Base do resumo"
                value={result.fonte_resumo === "pdf" ? "PDF" : "HTML (apoio)"}
              />
            ) : null}
            {typeof result.duracao_segundos === "number" ? (
              <SummaryMetaCard
                icon={<Clock3 className="h-4 w-4" />}
                label="Duração"
                value={`${result.duracao_segundos} s`}
              />
            ) : null}
          </div>
          <DialogTrigger asChild>
            <button
              aria-label="Abrir resumo em modal"
              className="group block w-full cursor-pointer rounded-[28px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              type="button"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.45)] transition group-hover:border-cyan-200/90 group-hover:bg-white/90 group-hover:shadow-[0_18px_40px_-28px_rgba(8,145,178,0.35)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Preview do markdown</p>
                    <p className="text-sm text-slate-600">
                      Clique no resumo para abrir a leitura completa em modal.
                    </p>
                  </div>
                  <div className="hidden items-center gap-1 text-sm font-medium text-cyan-700 sm:flex">
                    Expandir leitura
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-[26px] border border-cyan-100/80 bg-gradient-to-br from-white/90 via-cyan-50/30 to-teal-50/50 shadow-[0_14px_40px_-30px_rgba(8,145,178,0.5)] transition group-hover:border-cyan-200/90 group-hover:shadow-[0_20px_50px_-28px_rgba(8,145,178,0.42)]">
                  <div className="pointer-events-none">
                    <SummaryMarkdownContent
                      className="max-h-[23rem] overflow-hidden p-4 sm:p-5"
                      interactive={false}
                      markdown={cleanedMarkdown}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cyan-50 via-cyan-50/85 to-transparent" />
                  <div className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
                    <Maximize2 className="h-3.5 w-3.5" />
                    Abrir
                  </div>
                </div>
              </div>
            </button>
          </DialogTrigger>
        </CardContent>
      </Card>
      <DialogContent className="flex h-[min(92vh,900px)] flex-col overflow-hidden sm:h-[min(90vh,960px)]">
        <DialogHeader className="shrink-0 border-b border-slate-200/80 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-7">
          <div className="flex flex-col gap-4 pr-12 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
                <Sparkles className="h-3.5 w-3.5" />
                Leitura do resumo
              </div>
              <DialogTitle>{result.nome}</DialogTitle>
              <DialogDescription>
                Visualização completa do markdown com melhor leitura de tabelas, listas, blocos de código e detalhes do currículo.
              </DialogDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={copied ? "Markdown copiado" : "Copiar markdown"}
                  className="h-10 w-10 shrink-0 rounded-full border-slate-300 bg-white/90 px-0 text-slate-700 hover:bg-white"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void handleCopy();
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {copied ? "Markdown copiado" : "Copiar markdown"}
              </TooltipContent>
            </Tooltip>
          </div>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetaCard icon={<FileText className="h-4 w-4" />} label="Pessoa" value={result.nome} />
              {result.fonte_resumo ? (
                <SummaryMetaCard
                  icon={<Check className="h-4 w-4" />}
                  label="Base do resumo"
                  value={result.fonte_resumo === "pdf" ? "PDF" : "HTML (fallback)"}
                />
              ) : null}
              {typeof result.duracao_segundos === "number" ? (
                <SummaryMetaCard
                  icon={<Clock3 className="h-4 w-4" />}
                  label="Duracao"
                  value={`${result.duracao_segundos} s`}
                />
              ) : null}
            </div>
            <SummaryMarkdownContent className="mt-5" interactive markdown={cleanedMarkdown} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-8 border-b border-slate-200/80 pb-3 text-2xl font-semibold tracking-tight text-slate-950 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-7 text-xl font-semibold text-slate-950" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-700 sm:text-base" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700 sm:text-base" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-slate-700 sm:text-base" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 marker:font-semibold marker:text-cyan-700" {...props}>
      {children}
    </li>
  ),
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-800"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-5 rounded-r-2xl border-l-4 border-cyan-500 bg-cyan-50/70 px-4 py-3 text-[15px] italic leading-7 text-slate-700 sm:text-base"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_48px_-38px_rgba(15,23,42,0.45)]">
      <table className="min-w-full border-collapse text-left text-sm text-slate-700" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-950 text-white" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => <tbody className="divide-y divide-slate-200/80" {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => (
    <tr className="align-top odd:bg-white even:bg-slate-50/70" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em]" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-3 leading-6" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="my-8 border-slate-200/80" {...props} />,
  pre: ({ children, ...props }) => (
    <pre
      className="my-5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-100 shadow-[0_20px_60px_-42px_rgba(2,6,23,0.95)]"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlockCode = Boolean(className);

    return (
      <code
        className={cn(
          isBlockCode
            ? "font-mono text-[13px] text-slate-100"
            : "rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-950" {...props}>
      {children}
    </strong>
  ),
};

function SummaryMarkdownContent({
  markdown,
  className,
  interactive = true,
}: {
  markdown: string;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-[26px] border border-cyan-100/80 bg-gradient-to-br from-white/90 via-cyan-50/30 to-teal-50/50 p-4 shadow-[0_14px_40px_-30px_rgba(8,145,178,0.5)] sm:p-6",
        !interactive && "select-none [&_*]:pointer-events-none",
        className,
      )}
    >
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkBreaks]}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

function SummaryMetaCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-slate-950 sm:text-base">{value}</p>
    </div>
  );
}