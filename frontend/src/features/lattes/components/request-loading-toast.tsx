import { CircleSlash, LoaderCircle } from "lucide-react";

type RequestLoadingToastProps = {
  onCancel: () => void;
};

export function RequestLoadingToast({ onCancel }: RequestLoadingToastProps) {
  return (
    <div className="w-full min-w-[280px] max-w-[320px] rounded-[22px] border border-white/70 bg-white/96 p-3 text-slate-950 shadow-[0_18px_52px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 ring-1 ring-teal-200">
            <LoaderCircle className="h-4 w-4 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Solicitacao em andamento
            </p>
            <p className="text-sm font-semibold text-slate-950">Processando</p>
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
    </div>
  );
}