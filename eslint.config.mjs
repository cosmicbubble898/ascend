import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
  files: ["shell/**/*.{ts,mts}"],
  extends: [
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  ignores: ["dist/**", "node_modules/**"],
});
