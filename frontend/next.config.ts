import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Libera os hosts pelos quais o dev server é acessado remotamente (HMR/recursos
  // do Next em `next dev`). Só afeta desenvolvimento; ignorado no build de produção.
  allowedDevOrigins: ["200.136.209.229", "10.10.10.5"],
};

export default nextConfig;
