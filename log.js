const { appendFile } = require("fs");
const { inspect } = require("util");
const logFile = "output.log";

const logger = {
	log: (level = "log", ...data) => {
		const logMessage = `[${new Date().toISOString()}] [${level}] ${data.map(data => typeof data == "string" ? data : inspect(data)).join(" ")}`;

		/* eslint-disable no-console */
		console[level == "info" ? "log" : level](logMessage);
		appendFile(logFile, logMessage + "\n", null, error => { if (error) console.error(error); });
		/* eslint-enable no-console */
	 },
	 info: function() { logger.log("info", ...arguments); },
	 error: function() { logger.log("error", ...arguments); },
	 warn: function() { logger.log("warn", ...arguments); }
};

module.exports = logger;