import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // The picture carries the app's own stylesheets, read in as raw text, so
    // they have to be real here rather than stubbed away.
    css: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
