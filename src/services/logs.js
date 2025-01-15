import { client } from "../index.js";
const db = client.db;

async function addLogEntry(guild, user, action, details) {
	const logEntry = {
		timestamp: new Date().toISOString(),
		userId: user.id,
		username: user.username,
		action: action,
		details: details
	};

	// Get existing logs or create new array
	let guildLogs = (await db.get(`${guild.id}.logs`)) || [];

	// Add new log entry
	guildLogs.unshift(logEntry); // Add to start of array

	// Keep only last 100 entries to manage size
	if (guildLogs.length > 100) {
		guildLogs = guildLogs.slice(0, 100);
	}

	// Save logs
	await db.set(`${guild.id}.logs`, guildLogs);
	console.log(guildLogs);
}

export { addLogEntry };
