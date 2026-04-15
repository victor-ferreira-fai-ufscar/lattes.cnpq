"use client";

import { ArrowRight, ChevronDown, History } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  CurriculoHistoricoDiff,
  CurriculoHistoricoVersao,
} from "@/features/lattes/services/lattes.service";

type Props = {
  totalVersoes: number;
  primeiraVersao: CurriculoHistoricoVersao | null | undefined;
  ultimaVersao: CurriculoHistoricoVersao | null | undefined;
  diff: CurriculoHistoricoDiff | null | undefined;
};

type DiffLineType = "file-header" | "hunk" | "added" | "removed" | "context";
type ParsedDiffLine = { type: DiffLineType; raw: string };

function parseUnifiedDiff(preview: string): ParsedDiffLine[] {
  return preview
    .split("\n")
    .filter((line) => line.length > 0)
    .map((raw): ParsedDiffLine => {
      if (raw.startsWith("--- ") || raw.startsWith("+++ ")) {
        return { type: "file-header", raw };
      }
      if (raw.startsWith("@@")) return { type: "hunk", raw };
      if (raw.startsWith("+")) return { type: "added", raw };
      if (raw.startsWith("-")) return { type: "removed", raw };
      return { type: "context", raw };
    });
}

function DiffLine({ type, raw }: ParsedDiffLine) {
  if (type === "file-header") {
    return (
      <div className="bg-slate-50 px-4 py-0.5">
        <span className="font-mono text-[11px] text-slate-400">{raw}</span>
      </div>
    );
  }

  if (type === "hunk") {
    return (
      <div className="bg-sky-50 px-4 py-1">
        <span className="font-mono text-[11px] text-sky-600">{raw}</span>
      </div>
    );
  }

  if (type === "added") {
    return (
      <div className="flex bg-emerald-50/80 px-4 py-0.5">
        <span className="mr-2 w-3 shrink-0 select-none font-mono text-xs font-bold text-emerald-500">
          +
        </span>
        <span className="break-all whitespace-pre-wrap font-mono text-[12px] text-emerald-900">
          {raw.slice(1)}
        </span>
      </div>
    );
  }

  if (type === "removed") {
    return (
      <div className="flex bg-red-50/80 px-4 py-0.5">
        <span className="mr-2 w-3 shrink-0 select-none font-mono text-xs font-bold text-red-500">
          −
        </span>
        <span className="break-all whitespace-pre-wrap font-mono text-[12px] text-red-900">
          {raw.slice(1)}
        </span>
      </div>
    );
  }

  // context line (starts with a space in unified diff)
  return (
    <div className="flex px-4 py-0.5">
      <span className="mr-2 w-3 shrink-0 select-none font-mono text-xs text-transparent">
        ·
      </span>
      <span className="break-all whitespace-pre-wrap font-mono text-[12px] text-slate-500">
        {raw.slice(1)}
      </span>
    </div>
  );
}

function VersionChip({ label }: { label: string }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

function formatVersionLabel(v: CurriculoHistoricoVersao | null | undefined): string {
  if (!v) return "—";
  return v.ultima_atualizacao_curriculo ?? v.arquivo_pdf.replace(/\.pdf$/i, "");
}

export function CurriculoDiffCard({
  totalVersoes,
  primeiraVersao,
  ultimaVersao,
  diff,
}: Props) {
  if (!totalVersoes) return null;

  const isSingleVersion =
    !ultimaVersao ||
    primeiraVersao?.arquivo_pdf === ultimaVersao?.arquivo_pdf;

  const hasChanges = diff?.has_changes === true;
  const parsedLines =
    hasChanges && diff?.diff_preview ? parseUnifiedDiff(diff.diff_preview) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/75">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">
            Histórico de versões
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          {totalVersoes} {totalVersoes === 1 ? "versão salva" : "versões salvas"}
        </span>
      </div>

      {/* Version timeline + change summary */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 text-sm">
        <VersionChip label={formatVersionLabel(primeiraVersao)} />

        {!isSingleVersion && (
          <>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <VersionChip label={formatVersionLabel(ultimaVersao)} />
          </>
        )}

        <span
          className={cn(
            "ml-1 text-xs",
            isSingleVersion && "text-slate-400",
            !isSingleVersion && diff === null && "italic text-slate-400",
            !isSingleVersion && diff !== null && !hasChanges && "font-medium text-emerald-700",
            !isSingleVersion && hasChanges && "flex items-center gap-1.5",
          )}
        >
          {isSingleVersion ? (
            "Primeira versão registrada"
          ) : diff === null || diff === undefined ? (
            "Comparação não disponível"
          ) : !hasChanges ? (
            "✓ Sem alterações detectadas"
          ) : (
            <>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                +{diff.added_lines} {diff.added_lines === 1 ? "linha" : "linhas"}
              </span>
              {diff.removed_lines > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  −{diff.removed_lines} {diff.removed_lines === 1 ? "linha" : "linhas"}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Collapsible unified-diff view — only when there are changes */}
      {!isSingleVersion && hasChanges && parsedLines.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50/60 hover:text-slate-700">
            <span className="flex items-center gap-2">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              Ver diferenças linha a linha
            </span>
            <span className="font-normal text-slate-400">
              {parsedLines.filter((l) => l.type === "added" || l.type === "removed").length}{" "}
              linhas alteradas
            </span>
          </summary>

          <ScrollArea className="h-[360px] border-t border-slate-100">
            <div className="divide-y divide-slate-50/80">
              {parsedLines.map((line, i) => (
                <DiffLine key={i} {...line} />
              ))}
            </div>
          </ScrollArea>
        </details>
      )}
    </div>
  );
}
