import { client } from "../index.js";
import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	Collection
} from "discord.js";
import moment from "moment";

// Constants
const CONSTANTS = {
	CHUNK_SIZE: 8,
	MAX_TRIGGER_LENGTH: 2000,
	MAX_REPLY_LENGTH: 2048,
	MAX_FIELD_NAME_LENGTH: 256,
	MAX_FIELD_VALUE_LENGTH: 1000,
	EMBED_COLOR: "#A4D0A4",
	DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
	REPLY_SEPARATOR: " ⋄ " // Using a diamond separator
};

const emoji = client.emoji;

// Cache for expensive computations
const listCache = new Collection();

/**
 * Truncate text with ellipsis if needed
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + "...";
}

/**
 * Create a cache key for list data
 * @param {Array} guilddb - Guild database
 * @returns {string} Cache key
 */
function createCacheKey(guilddb) {
	return `${guilddb.length}-${JSON.stringify(guilddb[0])}`;
}

/**
 * Process guild database entries into displayable format
 * @param {Array} guilddb - Guild database
 * @returns {Object} Processed data
 */
function processGuildData(guilddb) {
	return guilddb.map((entry, i) => {
		const { trigger, replies, type, mode, probability = 100 } = entry;

		// Calculate available space for replies accounting for separator
		const separatorSpace =
			CONSTANTS.REPLY_SEPARATOR.length * (replies.length - 1);
		const maxReplyLength = Math.floor(
			(CONSTANTS.MAX_REPLY_LENGTH - separatorSpace) / replies.length
		);

		// Format trigger with probability if not 100%
		const triggerText =
			probability !== 100
				? `${emoji.dot} **${truncateText(trigger, CONSTANTS.MAX_TRIGGER_LENGTH)}** (${probability}%)`
				: `${emoji.dot} **${truncateText(trigger, CONSTANTS.MAX_TRIGGER_LENGTH)}**`;

		// Format replies with separators
		const formattedReplies = replies
			.map(reply => truncateText(reply.trim(), maxReplyLength))
			.join(CONSTANTS.REPLY_SEPARATOR);

		return {
			trigger: triggerText,
			reply: formattedReplies,
			type,
			mode
		};
	});
}
/**
 * Get paginated lists from guild database
 * @param {Array} guilddb - Guild database
 * @returns {Object} Paginated data
 */
function getLists(guilddb) {
	if (!Array.isArray(guilddb)) {
		throw new Error("Invalid guild database format");
	}

	// Check cache
	const cacheKey = createCacheKey(guilddb);
	const cached = listCache.get(cacheKey);
	if (cached) return cached;

	// Process data
	const listFullMap = processGuildData(guilddb);

	// Create pages
	const totalPages = Array.from(
		{ length: Math.ceil(listFullMap.length / CONSTANTS.CHUNK_SIZE) },
		(_, i) =>
			listFullMap.slice(
				i * CONSTANTS.CHUNK_SIZE,
				(i + 1) * CONSTANTS.CHUNK_SIZE
			)
	);

	// Cache results
	const result = { totalPages };
	listCache.set(cacheKey, result);

	return result;
}

/**
 * Create embed for list display
 * @param {Interaction} interaction - Discord interaction
 * @param {Array} guilddb - Guild database
 * @param {Array} totalPages - Total pages
 * @param {number} currentPage - Current page
 * @returns {EmbedBuilder} Discord embed
 */
function getListEmbed(interaction, guilddb, totalPages, currentPage) {
	try {
		const embed = new EmbedBuilder()
			.setTitle(
				`${interaction.guild.name} 的詞彙列表 - ${guilddb.length}個詞彙`
			)
			.setThumbnail(
				interaction.guild.iconURL({
					size: 4096,
					dynamic: true
				})
			)
			.setFooter({
				text: `${currentPage + 1}/${totalPages.length}\t ▪\t${moment(
					new Date()
				).format(CONSTANTS.DATE_FORMAT)}`
			})
			.setColor(CONSTANTS.EMBED_COLOR);

		// Add header field
		embed.addFields([
			{
				name: `${emoji.dot} **\`觸發詞\`**`,
				value: `${emoji.line1} \`回覆詞\`\n${emoji.line2} \`類型\`/\`模式\``,
				inline: true
			}
		]);

		// Add content fields
		totalPages[currentPage].forEach(field => {
			const { trigger, reply, type, mode } = field;

			embed.addFields([
				{
					name: truncateText(
						trigger,
						CONSTANTS.MAX_FIELD_NAME_LENGTH
					),
					value: `${truncateText(reply, CONSTANTS.MAX_FIELD_VALUE_LENGTH)}\n\`${type}\`/\`${mode}\``,
					inline: true
				}
			]);
		});

		return embed;
	} catch (error) {
		console.error("Error creating list embed:", error);
		throw error;
	}
}

/**
 * Create components for list navigation
 * @param {Array} totalPages - Total pages
 * @returns {Array} Discord components
 */
function getListComponents(totalPages) {
	const isMultiPage = totalPages.length > 1;

	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("listBack")
				.setEmoji("⬅")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!isMultiPage),
			new ButtonBuilder()
				.setCustomId("listRefresh")
				.setEmoji("🔄")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId("listNext")
				.setEmoji("➡")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!isMultiPage)
		)
	];
}

// Clean up old cache entries periodically
setInterval(
	() => {
		listCache.clear();
	},
	5 * 60 * 1000
); // Clear cache every 5 minutes

export { getLists, getListEmbed, getListComponents };
