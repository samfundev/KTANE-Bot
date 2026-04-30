import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from 'typescript-eslint';

export default defineConfig([
	js.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	{
		ignores: [
			"dist/*",
			"*.js",
		],
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: true
			},
		},

		rules: {
			semi: ["error", "always"],
			indent: [
				"error",
				"tab",
				{
					SwitchCase: 1,
				},
			],
			"no-console": "error",
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			yoda: "error",
			quotes: "error",

			// TypeScript ESLint rules
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/restrict-template-expressions": "off",

			"@typescript-eslint/unbound-method": [
				"error",
				{
					ignoreStatic: true,
				},
			],

			"@typescript-eslint/no-misused-promises": [
				"error",
				{
					checksVoidReturn: false,
				},
			],

			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
]);
