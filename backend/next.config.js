import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root
  }
};

export default nextConfig;
