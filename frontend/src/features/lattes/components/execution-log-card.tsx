import { TerminalSquare } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ExecutionLogCardProps = {
  logs: string[];
};

export function ExecutionLogCard({ logs }: ExecutionLogCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.95)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <TerminalSquare className="h-4 w-4 text-teal-300" />
          Logs da execução
        </CardTitle>
        <CardDescription className="text-slate-400">
          Painel consolidado com os logs mais recentes do scraping, lote ou
          resumo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/70 p-4 font-mono text-xs leading-6 text-slate-200">
            {logs.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-4 text-sm text-slate-400">
            Nenhum log disponível ainda.
          </div>
        )}
      </CardContent>
    </Card>
  );
}