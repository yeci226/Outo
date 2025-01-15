import { client } from "../index.js";
import { ChannelType, Collection } from "discord.js";
const db = client.db;

// Constants
const CONSTANTS = {
	CACHE_LIFETIME: 5 * 60 * 1000, // 5 minutes
	COOLDOWN: 500, // 0.5 second
	MAX_CACHE_SIZE: 100
};

// Cache for guild data
const guildCache = new Collection();
const cooldowns = new Collection();

/**
 * Cache manager for guild data
 */
class GuildDataManager {
	/**
	 * Get optimized data structure from raw data
	 * @param {Array} data - Raw guild data
	 * @returns {Object} Optimized data structure
	 */
	static optimizeData(data) {
		if (!data) return null;

		const optimizedData = {
			exact: new Map(),
			partial: []
		};

		data.forEach(entry => {
			if (entry.type === "相同") {
				optimizedData.exact.set(entry.trigger, entry);
			} else {
				optimizedData.partial.push(entry);
			}
		});

		return optimizedData;
	}

	/**
	 * Update cache for a specific guild
	 * @param {string} guildId - Guild ID
	 * @param {Array} data - New guild data
	 */
	static updateCache(guildId, data) {
		const optimizedData = this.optimizeData(data);
		if (optimizedData) {
			guildCache.set(guildId, {
				timestamp: Date.now(),
				data: optimizedData
			});

			// Cleanup old cache entries
			if (guildCache.size > CONSTANTS.MAX_CACHE_SIZE) {
				const oldestKey = guildCache.reduce(
					(oldest, value, key) =>
						!oldest ||
						value.timestamp < guildCache.get(oldest).timestamp
							? key
							: oldest,
					null
				);
				if (oldestKey) guildCache.delete(oldestKey);
			}
		}
	}

	/**
	 * Get guild data from cache or database
	 * @param {string} guildId - Guild ID
	 * @returns {Promise<Object>} Guild data
	 */
	static async getGuildData(guildId) {
		const now = Date.now();
		const cached = guildCache.get(guildId);

		// Return cached data if valid
		if (cached && now - cached.timestamp < CONSTANTS.CACHE_LIFETIME) {
			return cached.data;
		}

		// Fetch new data
		try {
			const data = await db.get(`${guildId}.replies`);
			const optimizedData = this.optimizeData(data);

			if (optimizedData) {
				this.updateCache(guildId, data);
			}

			return optimizedData;
		} catch (error) {
			console.error(`Error fetching guild data for ${guildId}:`, error);
			return null;
		}
	}
}

function checkCooldown(channelId) {
	const now = Date.now();
	const lastMessage = cooldowns.get(channelId);

	if (lastMessage && now - lastMessage < CONSTANTS.COOLDOWN) {
		return true;
	}

	cooldowns.set(channelId, now);
	return false;
}

function findMatch(guildData, content) {
	const exactMatch = guildData.exact.get(content);
	if (exactMatch) return exactMatch;

	return guildData.partial.find(entry => content.includes(entry.trigger));
}

async function sendResponse(message, entry) {
	try {
		const { replies, mode, probability = 100 } = entry;

		// Check probability
		if (probability < 100 && Math.random() * 100 > probability) {
			return; // Skip response based on probability
		}

		const reply = replies[Math.floor(Math.random() * replies.length)];

		if (mode === "訊息") {
			await message.channel.send({ content: reply });
		} else {
			await message.reply({ content: reply });
		}
	} catch (error) {
		console.error("Error sending response:", error);
	}
}

// Export the GuildDataManager for use in other files
export { GuildDataManager };

// Main event handler
client.on("messageCreate", async message => {
	if (
		message.author.bot ||
		message.system ||
		message.channel.type === ChannelType.DM
	)
		return;

	try {
		const guildData = await GuildDataManager.getGuildData(message.guild.id);
		if (!guildData) return;

		const matchedEntry = findMatch(guildData, message.content);
		if (!matchedEntry) return;

		await sendResponse(message, matchedEntry);
	} catch (error) {
		console.error("Error processing message:", error);
	}
});
