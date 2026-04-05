"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton={false}
      expand={false}
      gap={12}
      position="bottom-right"
      richColors={false}
      toastOptions={{
        className:
          "rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,250,0.94))] p-0 text-slate-950 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.45)] ring-1 ring-teal-100/80 backdrop-blur-xl",
        classNames: {
          content: "gap-0 p-0",
          description: "text-slate-600",
          title: "text-slate-950",
          toast:
            "rounded-[28px] border-0 bg-transparent shadow-none ring-0 data-[visible=true]:animate-in data-[visible=true]:slide-in-from-bottom-3 data-[visible=true]:fade-in",
        },
      }}
      visibleToasts={5}
      offset={{ bottom: "1.25rem", right: "1.25rem", left: "1rem" }}
      mobileOffset={{ bottom: "6.5rem", right: "0.875rem", left: "0.875rem" }}
    />
  );
}