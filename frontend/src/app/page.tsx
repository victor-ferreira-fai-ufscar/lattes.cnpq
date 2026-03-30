import { Suspense } from "react";

import { PageLoader } from "@/components/shared/page-loader";
import { LattesWorkbench } from "@/features/lattes/components/lattes-workbench";

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LattesWorkbench />
    </Suspense>
  );
}
