module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // Enforce consistent code quality
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: ["error", "always"],
    "no-throw-literal": "error",
    "no-return-await": "warn",
    "require-await": "warn",

    // Style consistency
    quotes: ["warn", "single", { avoidEscape: true }],
    semi: ["warn", "always"],
    "comma-dangle": ["warn", "always-multiline"],
    "no-trailing-spaces": "warn",
    "no-multiple-empty-lines": ["warn", { max: 1 }],
  },
};
