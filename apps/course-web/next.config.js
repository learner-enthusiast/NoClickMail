import path from "node:path";

const nextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
