module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },
  env: {
    es2021: true,
    node: true,
    jest: true
  },
  ignorePatterns: ["dist", "coverage", ".expo", "node_modules", "supabase/functions/**"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": "error"
  }
};
