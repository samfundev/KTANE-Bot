const { existsSync, copyFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const databasePath = "database.sqlite3";
if (!existsSync(databasePath)) {
	writeFileSync(databasePath, "");
}

const tokensPath = join("src", "tokens.json");
if (!existsSync(tokensPath)) {
	copyFileSync(join("src", "tokens.template.json"), tokensPath);
}