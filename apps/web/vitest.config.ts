import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts"]
  }
});
