import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {},
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
