"use client";

import { ChevronDown, TerminalSquare, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ExecutionLogCardProps = {
  className?: string;
  isProcessing?: boolean;
  logs: string[];
  onClearLogs?: () => void;
  variant?: "default" | "floating";
};

export function ExecutionLogCard({
  className,
  isProcessing = false,
  logs,
  onClearLogs,
  variant = "default",
}: ExecutionLogCardProps) {
  const isFloating = variant === "floating";
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs.length]);

  return (
    <Card className={cn(isFloating && "h-full", className)} variant="inverse">
      {!isFloating ? (
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <TerminalSquare className="h-4 w-4 text-teal-300" />
                Detalhes técnicos da execução
              </CardTitle>
              <CardDescription className="mt-2 text-slate-400">
                Esses registros ficam escondidos por padrão. Abra apenas se quiser
                acompanhar o processamento com mais detalhe no horário de Brasília (GMT-3).
              </CardDescription>
            </div>
            {onClearLogs ? (
              <button
                aria-label="Limpar logs"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-slate-300 transition hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={logs.length === 0}
                type="button"
                onClick={onClearLogs}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn(isFloating && "flex h-full min-h-0 flex-col p-0")}>
        {logs.length > 0 ? (
          isFloating ? (
            <ScrollArea
              className="h-full min-h-0 rounded-2xl border border-white/10 bg-slate-950/80"
              type="always"
            >
              <div className="w-max min-w-full space-y-2 p-4 pr-5 font-mono text-xs leading-6 text-slate-200">
                {logs.map((line, index) => (
                  <p key={`${line}-${index}`} className="whitespace-pre">
                    {line}
                  </p>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          ) : (
            <details className="group rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-100">
                Ver registros da execução
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <ScrollArea
                className="mt-4 max-h-72 rounded-2xl border border-white/10 bg-slate-950/70"
                type="always"
              >
                <div className="w-max min-w-full space-y-2 p-4 pr-5 font-mono text-xs leading-6 text-slate-200">
                  {logs.map((line, index) => (
                    <p key={`${line}-${index}`} className="whitespace-pre">
                      {line}
                    </p>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </details>
          )
        ) : isProcessing ? (
          <div className={cn(
            "rounded-2xl border border-teal-400/20 bg-slate-900/60 p-4 text-sm text-slate-300",
            isFloating && "flex h-full min-h-0 items-start",
          )}>
            <div className="flex items-start gap-3">
              <Spinner className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <div>
                <p className="font-medium text-slate-100">Execução em andamento</p>
                <p className="mt-1 text-slate-400">
                  Os registros técnicos aparecerão aqui assim que o backend enviar novas linhas.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn(
            "rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-4 text-sm text-slate-400",
            isFloating && "flex h-full min-h-0 items-center",
          )}>
            Nenhum registro disponível ainda. Eles aparecem quando uma busca ou processamento começa.
          </div>
        )}
      </CardContent>
    </Card>
  );
}