import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shell/**/*.test.mts"],
  },
});
