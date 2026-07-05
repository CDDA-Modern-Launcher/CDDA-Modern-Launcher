import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default defineConfig(
    { ignores: ["**/node_modules", "**/dist", "**/out"] },
    tseslint.configs.recommended,
    eslintPluginReact.configs.flat.recommended,
    eslintPluginReact.configs.flat["jsx-runtime"],
    {
        settings: {
            react: {
                version: "detect"
            }
        }
    },
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": eslintPluginReactHooks,
            "react-refresh": eslintPluginReactRefresh
        },
        rules: {
            ...eslintPluginReactHooks.configs.recommended.rules,
            ...eslintPluginReactRefresh.configs.vite.rules,
            "no-undef": "error"
        }
    },
    eslintConfigPrettier,
    {
        files: ["src/main/**/*.{ts,tsx}", "src/preload/**/*.{ts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.node,
                NodeJS: "readonly"
            }
        }
    }
);
