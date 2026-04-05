import { CircleSlash, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type RequestLoadingModalProps = {
  title: string;
  description: string;
  hint?: string;
  onCancel: () => void;
};

export function RequestLoadingModal({
  title,
  description,
  hint,
  onCancel,
}: RequestLoadingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 px-3 pb-3 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-0">
      <div
        aria-busy="true"
        aria-live="assertive"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-lg rounded-[28px] rounded-b-[28px] rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,74,110,0.92))] p-5 text-white shadow-[0_36px_120px_-48px_rgba(2,6,23,0.95)] sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-200 ring-1 ring-inset ring-teal-300/30">
            <Spinner className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              <Sparkles className="h-3.5 w-3.5" />
              Solicitacao em andamento
            </div>
            <p className="mt-3 text-xl font-semibold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{description}</p>
            {hint ? <p className="mt-3 text-xs text-slate-300">{hint}</p> : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          Enquanto esta operacao nao terminar, os campos e a navegacao ficam bloqueados para evitar conflitos na execucao.
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            <CircleSlash className="h-4 w-4" />
            Cancelar solicitacao
          </Button>
        </div>
      </div>
    </div>
  );
}