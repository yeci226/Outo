import { ChannelType, Collection, Message, Events } from "discord.js";
import { client, database } from "../index.js";

interface TriggerEntry {
	trigger: string;
	replies: string[];
	type: string;
	mode: string;
	probability: number;
}

interface OptimizedData {
	exact: Map<string, TriggerEntry>;
	partial: TriggerEntry[];
}

interface CacheEntry {
	timestamp: number;
	data: OptimizedData;
}

// Constants
const CONSTANTS = {
	CACHE_LIFETIME: 5 * 60 * 1000, // 5 minutes
	COOLDOWN: 500, // 0.5 second
	MAX_CACHE_SIZE: 100
};

// Cache for guild data
const guildCache = new Collection<string, CacheEntry>();
const cooldowns = new Collection<string, number>();

/**
 * Cache manager for guild data
 */
class GuildDataManager {
	/**
	 * Get optimized data structure from raw data
	 * @param {TriggerEntry[]} data - Raw guild data
	 * @returns {OptimizedData | null} Optimized data structure
	 */
	static optimizeData(data: TriggerEntry[]): OptimizedData | null {
		if (!data) return null;

		const optimizedData: OptimizedData = {
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
	 * @param {TriggerEntry[]} data - New guild data
	 */
	static updateCache(guildId: string, data: TriggerEntry[]): void {
		const optimizedData = this.optimizeData(data);
		if (optimizedData) {
			guildCache.set(guildId, {
				timestamp: Date.now(),
				data: optimizedData
			});

			// Cleanup old cache entries
			if (guildCache.size > CONSTANTS.MAX_CACHE_SIZE) {
				const oldestKey = guildCache.reduce(
					(oldest: string | null, value: CacheEntry, key: string) =>
						!oldest ||
						value.timestamp < guildCache.get(oldest)!.timestamp
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
	 * @returns {Promise<OptimizedData | null>} Guild data
	 */
	static async getGuildData(guildId: string): Promise<OptimizedData | null> {
		const now = Date.now();
		const cached = guildCache.get(guildId);

		// Return cached data if valid
		if (cached && now - cached.timestamp < CONSTANTS.CACHE_LIFETIME) {
			return cached.data;
		}

		// Fetch new data
		try {
			const data = (await database.get(
				`${guildId}.replies`
			)) as TriggerEntry[];
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

function checkCooldown(channelId: string): boolean {
	const now = Date.now();
	const lastMessage = cooldowns.get(channelId);

	if (lastMessage && now - lastMessage < CONSTANTS.COOLDOWN) {
		return true;
	}

	cooldowns.set(channelId, now);
	return false;
}

function findMatch(
	guildData: OptimizedData,
	content: string
): TriggerEntry | undefined {
	const exactMatch = guildData.exact.get(content);
	if (exactMatch) return exactMatch;

	return guildData.partial.find(entry => content.includes(entry.trigger));
}

async function sendResponse(
	message: Message,
	entry: TriggerEntry
): Promise<void> {
	try {
		const { replies, mode, probability = 100 } = entry;

		// Check probability
		if (probability < 100 && Math.random() * 100 > probability) {
			return; // Skip response based on probability
		}

		const reply = replies[Math.floor(Math.random() * replies.length)];

		if (mode === "訊息") {
			if ("send" in message.channel) {
				await message.channel.send({ content: reply || "" });
			}
		} else {
			await message.reply({ content: reply || "" });
		}
	} catch (error) {
		console.error("Error sending response:", error);
	}
}

// Export the GuildDataManager for use in other files
export { GuildDataManager };

// Main event handler
client.on(Events.MessageCreate, async (message: Message) => {
	if (
		message.author.bot ||
		message.system ||
		message.channel.type === ChannelType.DM
	)
		return;

	try {
		if (!message.guild) return;

		const guildData = await GuildDataManager.getGuildData(message.guild.id);
		if (!guildData) return;

		const matchedEntry = findMatch(guildData, message.content);
		if (!matchedEntry) return;

		await sendResponse(message, matchedEntry);
	} catch (error) {
		console.error("Error processing message:", error);
	}
});
