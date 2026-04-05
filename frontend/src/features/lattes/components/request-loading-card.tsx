import { Sparkles } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

type RequestLoadingCardProps = {
  title: string;
  description: string;
  hint?: string;
};

export function RequestLoadingCard({
  title,
  description,
  hint,
}: RequestLoadingCardProps) {
  return (
    <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-r from-teal-50 via-white to-cyan-50 px-5 py-4 shadow-[0_18px_60px_-42px_rgba(15,118,110,0.65)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
          <Spinner className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
            <Sparkles className="h-3.5 w-3.5" />
            Processando solicitacao
          </div>
          <p className="mt-2 text-base font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          {hint ? <p className="mt-3 text-xs text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}