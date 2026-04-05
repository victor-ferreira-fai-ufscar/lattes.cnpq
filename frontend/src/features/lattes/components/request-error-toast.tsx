import { AlertTriangle, RefreshCcw } from "lucide-react";

type RequestErrorToastProps = {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function RequestErrorToast({
  title,
  message,
  retryLabel,
  onRetry,
}: RequestErrorToastProps) {
  return (
    <div className="w-full min-w-[300px] max-w-[420px] rounded-[28px] bg-transparent p-0 text-slate-950">
      <div className="overflow-hidden rounded-[28px]">
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,#ef4444,#fb7185,#f59e0b)]" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-red-100 text-red-700 shadow-inner ring-1 ring-red-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-700">
                  Ocorreu um problema
                </p>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-800">
                  Erro
                </span>
              </div>
              <p className="mt-2.5 text-[15px] font-semibold leading-6 text-slate-950">
                {title}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{message}</p>
            </div>
          </div>

          {onRetry ? (
            <div className="mt-4 flex justify-end">
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
                type="button"
                onClick={onRetry}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {retryLabel ?? "Tentar novamente"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}