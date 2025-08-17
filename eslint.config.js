export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
        globals: {
          document: "readonly",
          window: "readonly",
          navigator: "readonly",
          localStorage: "readonly",
          fetch: "readonly",
          L: "readonly",
          Papa: "readonly"
        }
    },
    rules: {
      "no-unused-vars": ["error", { "vars": "all", "args": "none", "ignoreRestSiblings": true }],
      "no-undef": "error"
    }
  }
];
