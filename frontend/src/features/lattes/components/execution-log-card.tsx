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

type ExecutionLogCardProps = {
  isProcessing?: boolean;
  logs: string[];
  variant?: "default" | "floating";
};

export function ExecutionLogCard({
  isProcessing = false,
  logs,
  variant = "default",
}: ExecutionLogCardProps) {
  const isFloating = variant === "floating";

  return (
    <Card variant="inverse">
      {!isFloating ? (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <TerminalSquare className="h-4 w-4 text-teal-300" />
            Detalhes da execucao
          </CardTitle>
          <CardDescription className="text-slate-400">
            Os registros tecnicos ficam escondidos por padrao. Abra apenas se
            quiser acompanhar o que aconteceu durante o processamento no horario
            de Brasilia (GMT-3).
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent>
        {logs.length > 0 ? (
          isFloating ? (
            <ScrollArea className="max-h-80 rounded-2xl border border-white/10 bg-slate-950/80">
              <div className="space-y-2 p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-200">
                {logs.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <details className="group rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-100">
                Ver registros da execucao
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <ScrollArea className="mt-4 max-h-72 rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="space-y-2 p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-200">
                  {logs.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              </ScrollArea>
            </details>
          )
        ) : isProcessing ? (
          <div className="rounded-2xl border border-teal-400/20 bg-slate-900/60 p-4 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <Spinner className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <div>
                <p className="font-medium text-slate-100">Execucao em andamento</p>
                <p className="mt-1 text-slate-400">
                  Os registros tecnicos aparecerao aqui assim que o backend enviar novas linhas.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-4 text-sm text-slate-400">
            Nenhum registro disponivel ainda.
          </div>
        )}
      </CardContent>
    </Card>
  );
}