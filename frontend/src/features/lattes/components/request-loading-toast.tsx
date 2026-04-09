"use client";

import { CircleSlash, Clock3, LoaderCircle, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";

type RequestLoadingToastProps = {
  title: string;
  description: string;
  onCancel: () => void;
  onViewDetails: () => void;
};

export function RequestLoadingToast({
  title,
  description,
  onCancel,
  onViewDetails,
}: RequestLoadingToastProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="w-full min-w-[300px] max-w-[360px] rounded-[22px] border border-white/70 bg-white/96 p-3 text-slate-950 shadow-[0_18px_52px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 ring-1 ring-teal-200">
              <LoaderCircle className="h-4 w-4 animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Solicitação em andamento
              </p>
              <p className="text-sm font-semibold text-slate-950">{title}</p>
            </div>
          </div>
          <button
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={onCancel}
          >
            <CircleSlash className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>

        <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium leading-5 text-slate-600">
              {description}
            </p>
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-teal-800">
              <Clock3 className="h-3.5 w-3.5" />
              {formatElapsedTime(elapsedMs)}
            </div>
          </div>
        </div>

        <button
          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
          type="button"
          onClick={onViewDetails}
        >
          <TerminalSquare className="h-3.5 w-3.5" />
          Ver detalhes da execução
        </button>
      </div>
    </div>
  );
}

function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}