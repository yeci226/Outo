import { client } from "../index.js";
import { EmbedBuilder } from "discord.js";
import { QuickDB } from "quick.db";
import { GuildDataManager } from "./reply.js";

const db = new QuickDB();

const CONSTANTS = {
	MODAL_ID: "add",
	MAX_TRIGGER_LENGTH: 2048,
	MAX_REPLIES_LENGTH: 2048,
	VALID_TYPES: ["包含", "相同"],
	VALID_MODES: ["回覆", "訊息"],
	FORBIDDEN_MENTIONS: ["@everyone", "@here"],
	ERROR_COLOR: "#EE4E4E",
	SUCCESS_COLOR: "#A1DD70",
	ERROR_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif",
	SUCCESS_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552199450333204/discord.gif",
	DEFAULT_PROBABILITY: 100
};

function createErrorEmbed(title, description = null) {
	const embed = new EmbedBuilder()
		.setThumbnail(CONSTANTS.ERROR_THUMBNAIL)
		.setTitle(title)
		.setColor(CONSTANTS.ERROR_COLOR);

	if (description) {
		embed.setDescription(description);
	}

	return embed;
}

function validateInputs(type, mode, probability) {
	if (!CONSTANTS.VALID_TYPES.includes(type)) {
		return {
			isValid: false,
			error: createErrorEmbed(
				"請確定輸入的類型為 `包含` 或者 `相同`",
				`你輸入的是 \`${type}\``
			)
		};
	}

	if (!CONSTANTS.VALID_MODES.includes(mode)) {
		return {
			isValid: false,
			error: createErrorEmbed(
				"請確定輸入發送訊息類型為 `回覆` 或者 `訊息`",
				`你輸入的是 \`${mode}\``
			)
		};
	}

	const prob = Number(probability);
	if (isNaN(prob) || prob < 0 || prob > 100) {
		return {
			isValid: false,
			error: createErrorEmbed(
				"回覆機率必須是 0-100 之間的數字",
				`你輸入的是 \`${probability}\``
			)
		};
	}

	return { isValid: true };
}

function truncateText(text, maxLength) {
	if (text.length > maxLength) {
		return text.slice(0, maxLength - 3) + "...";
	}
	return text;
}

client.on("interactionCreate", async interaction => {
	if (
		!interaction.isModalSubmit() ||
		interaction.customId !== CONSTANTS.MODAL_ID
	)
		return;

	try {
		// Get form values
		const trigger = interaction.fields
			.getTextInputValue("add_trigger")
			.trim();
		const replies = interaction.fields
			.getTextInputValue("add_reply")
			.split("</>")
			.filter(reply => reply.trim().length > 0)
			.map(reply => reply.trim());
		const type = interaction.fields.getTextInputValue("add_type").trim();
		const mode = interaction.fields.getTextInputValue("add_mode").trim();
		const probability =
			interaction.fields.getTextInputValue("add_probability")?.trim() ||
			CONSTANTS.DEFAULT_PROBABILITY.toString();

		// Validate inputs
		if (replies.length === 0) {
			return interaction.reply({
				embeds: [createErrorEmbed("請至少輸入一個回覆詞彙")],
				ephemeral: true
			});
		}

		if (
			replies.some(reply =>
				CONSTANTS.FORBIDDEN_MENTIONS.some(mention =>
					reply.includes(mention)
				)
			)
		) {
			return interaction.reply({
				embeds: [createErrorEmbed("嘿！這是禁止的詞彙")],
				ephemeral: true
			});
		}

		const validation = validateInputs(type, mode, probability);
		if (!validation.isValid) {
			return interaction.reply({
				embeds: [validation.error],
				ephemeral: true
			});
		}

		// Prepare database entry
		const entry = {
			trigger,
			replies,
			type,
			mode,
			probability: Number(probability)
		};

		let guilddb = (await db.get(`${interaction.guild.id}.replies`)) || [];
		const index = guilddb.findIndex(e => e.trigger === trigger);

		// Update or add entry
		if (index !== -1) {
			guilddb[index] = entry;
		} else {
			guilddb.push(entry);
		}

		// Update database
		await db.set(`${interaction.guild.id}`, { replies: guilddb });
		GuildDataManager.updateCache(interaction.guild.id, guilddb);

		// Create success response
		const successEmbed = new EmbedBuilder()
			.setColor(CONSTANTS.SUCCESS_COLOR)
			.setThumbnail(CONSTANTS.SUCCESS_THUMBNAIL)
			.setTitle("已添加新詞彙")
			.addFields([
				{
					name: "觸發詞",
					value: `\`${truncateText(trigger, CONSTANTS.MAX_TRIGGER_LENGTH)}\``,
					inline: false
				},
				{
					name: "回覆",
					value: truncateText(
						replies.join("\n"),
						CONSTANTS.MAX_REPLIES_LENGTH
					),
					inline: false
				},
				{
					name: "觸發類型",
					value: `\`${type}\``,
					inline: false
				},
				{
					name: "發送訊息類型",
					value: `\`${mode}\``,
					inline: false
				},
				{
					name: "回覆機率",
					value: `\`${entry.probability}%\``,
					inline: false
				}
			]);

		await interaction.reply({
			embeds: [successEmbed],
			ephemeral: true
		});
	} catch (error) {
		console.error("Modal submission error:", error);
		await interaction.reply({
			embeds: [createErrorEmbed("處理你的請求時發生錯誤，請稍後再試")],
			ephemeral: true
		});
	}
});
