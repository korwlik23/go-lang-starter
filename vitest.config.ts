import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    include: ["integration/tests/**/*.test.ts"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
