import type { Metadata } from "next";
import { Suspense } from "react";

import { PageLoader } from "@/components/shared/page-loader";
import { LattesWorkbench } from "@/features/lattes/components/lattes-workbench";

export const metadata: Metadata = {
  title: "Processamento em Lote",
};

export default function BatchPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LattesWorkbench />
    </Suspense>
  );
}
