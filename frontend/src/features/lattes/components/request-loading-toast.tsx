import { CircleSlash, LoaderCircle } from "lucide-react";

type RequestLoadingToastProps = {
  title: string;
  description: string;
  hint?: string;
  onCancel: () => void;
};

export function RequestLoadingToast({
  title,
  description,
  hint,
  onCancel,
}: RequestLoadingToastProps) {
  return (
    <div className="w-full min-w-[300px] max-w-[420px] rounded-[28px] bg-transparent p-0 text-slate-950">
      <div className="overflow-hidden rounded-[28px]">
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,#14b8a6,#2dd4bf,#f59e0b)]" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-teal-100 text-teal-700 shadow-inner ring-1 ring-teal-200">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Solicitacao em andamento
                </p>
                <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                  Processando
                </span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold leading-6 text-slate-950">
                {title}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
              {hint ? (
                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/75 px-3 py-2 text-xs leading-5 text-slate-500">
                  {hint}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[26rem] text-xs leading-5 text-slate-500">
              A leitura da pagina continua liberada, mas os controles do fluxo ficam bloqueados ate concluir ou cancelar.
            </p>
            <button
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              type="button"
              onClick={onCancel}
            >
              <CircleSlash className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}