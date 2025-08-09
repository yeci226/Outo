import { client, database } from "../index.js";
import { getLists, getListEmbed, getListComponents } from "../services/list.js";
import { EmbedBuilder, Collection, Events, MessageFlags } from "discord.js";
import { createSafeEmbed } from "../utils/embedHelper.js";

interface PageData {
	guildReplies: any[];
	currentPage: number;
}

interface CacheEntry {
	timestamp: number;
	data: PageData;
}

// Constants
const CONSTANTS = {
	BUTTON_PREFIX: "list",
	ERROR_COLOR: "#EE4E4E",
	ERROR_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif",
	COOLDOWN: 2000, // 2 seconds
	CACHE_LIFETIME: 5 * 60 * 1000 // 5 minutes
};

// Initialize database and caches
const cooldowns = new Collection<string, number>();
const pageCache = new Collection<string, CacheEntry>();

/**
 * Button action types and their handlers
 */
const ACTIONS: Record<
	string,
	(currentPage: number, totalPages: any[]) => number
> = {
	listBack: (currentPage: number, totalPages: any[]) =>
		(currentPage - 1 + totalPages.length) % totalPages.length,
	listNext: (currentPage: number, totalPages: any[]) =>
		(currentPage + 1) % totalPages.length,
	listRefresh: (currentPage: number) => currentPage
};

/**
 * Check and update cooldown for a user
 * @param {string} userId - User ID
 * @returns {boolean} - Whether the user is in cooldown
 */
function checkCooldown(userId: string): boolean {
	const now = Date.now();
	const lastInteraction = cooldowns.get(userId);

	if (lastInteraction && now - lastInteraction < CONSTANTS.COOLDOWN) {
		return true;
	}

	cooldowns.set(userId, now);
	return false;
}

/**
 * Get cached page data or fetch from database
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<PageData>} Page data
 */
async function getPageData(guildId: string, userId: string): Promise<PageData> {
	const cacheKey = `${guildId}-${userId}`;
	const now = Date.now();
	const cached = pageCache.get(cacheKey);

	if (cached && now - cached.timestamp < CONSTANTS.CACHE_LIFETIME) {
		return cached.data;
	}

	const guildData = await database.get(guildId);
	const userData = await database.get(`${userId}.list`);

	const data: PageData = {
		guildReplies: guildData?.replies || [],
		currentPage: userData?.currentPage || 0
	};

	pageCache.set(cacheKey, {
		timestamp: now,
		data
	});

	return data;
}

/**
 * Create error embed
 * @param {string} message - Error message
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message: string): EmbedBuilder {
	return createSafeEmbed({
		title: message,
		color: CONSTANTS.ERROR_COLOR,
		thumbnail: CONSTANTS.ERROR_THUMBNAIL
	});
}

/**
 * Handle list button interactions
 */
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isButton()) return;

	const { customId } = interaction;
	if (!customId.startsWith(CONSTANTS.BUTTON_PREFIX)) return;

	// Check cooldown
	if (checkCooldown(interaction.user.id)) {
		await interaction.followUp({
			embeds: [createErrorEmbed("請稍等一下再操作")],
			flags: MessageFlags.Ephemeral
		});
		return;
	}

	try {
		const guildId = interaction.guild?.id;
		if (!guildId) {
			await interaction.followUp({
				embeds: [createErrorEmbed("無法獲取伺服器資訊")],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Get page data
		const { guildReplies, currentPage } = await getPageData(
			guildId,
			interaction.user.id
		);

		if (!guildReplies || guildReplies.length === 0) {
			await interaction.followUp({
				embeds: [
					createSafeEmbed({
						title: "我沒有在這個伺服器找到任何詞彙！",
						color: CONSTANTS.ERROR_COLOR,
						thumbnail: CONSTANTS.ERROR_THUMBNAIL
					})
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		// Get paginated data
		const { totalPages } = getLists(guildReplies);

		// Calculate new page
		const action = ACTIONS[customId];
		if (!action) {
			await interaction.followUp({
				embeds: [createErrorEmbed("無效的操作")],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const newPage = action(currentPage, totalPages);

		// Update user's current page
		await database.set(`${interaction.user.id}.list`, {
			currentPage: newPage
		});

		// Create new embed
		const embed = getListEmbed(
			interaction,
			guildReplies,
			totalPages,
			newPage
		);

		// Update the message
		await interaction.message.edit({
			embeds: [embed],
			components: getListComponents(totalPages)
		});
	} catch (error) {
		console.error("Error handling list button interaction:", error);
		await interaction.followUp({
			embeds: [createErrorEmbed("處理操作時發生錯誤")],
			flags: MessageFlags.Ephemeral
		});
	}
});

// Clean up old cache entries periodically
setInterval(() => {
	const now = Date.now();

	// Clean up cooldowns
	for (const [userId, timestamp] of cooldowns.entries()) {
		if (now - timestamp > CONSTANTS.COOLDOWN) {
			cooldowns.delete(userId);
		}
	}

	// Clean up page cache
	for (const [key, entry] of pageCache.entries()) {
		if (now - entry.timestamp > CONSTANTS.CACHE_LIFETIME) {
			pageCache.delete(key);
		}
	}
}, 60 * 1000); // Clean up every minute
