import { ChevronDown, TerminalSquare } from "lucide-react";

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
  variant?: "default" | "floating";
};

export function ExecutionLogCard({
  className,
  isProcessing = false,
  logs,
  variant = "default",
}: ExecutionLogCardProps) {
  const isFloating = variant === "floating";

  return (
    <Card className={cn(isFloating && "h-full", className)} variant="inverse">
      {!isFloating ? (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <TerminalSquare className="h-4 w-4 text-teal-300" />
            Detalhes técnicos da execução
          </CardTitle>
          <CardDescription className="text-slate-400">
            Esses registros ficam escondidos por padrão. Abra apenas se quiser
            acompanhar o processamento com mais detalhe no horário de Brasília (GMT-3).
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className={cn(isFloating && "flex h-full min-h-0 flex-col p-0")}>
        {logs.length > 0 ? (
          isFloating ? (
            <ScrollArea className="h-full min-h-0 rounded-2xl border border-white/10 bg-slate-950/80">
              <div className="space-y-2 p-4 pr-5 font-mono text-xs leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-200">
                {logs.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <details className="group rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-100">
                Ver registros da execução
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <ScrollArea className="mt-4 max-h-72 rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="space-y-2 p-4 pr-5 font-mono text-xs leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-200">
                  {logs.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
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