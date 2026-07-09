import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Workspace-Root explizit setzen (verhindert falsche Lockfile-Erkennung)
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
