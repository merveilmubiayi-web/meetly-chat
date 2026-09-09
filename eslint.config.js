// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "supabase/functions/**",
      "src/components/app-tabs.tsx",
      "src/components/app-tabs.web.tsx",
      "src/components/external-link.tsx",
    ],
  }
]);
