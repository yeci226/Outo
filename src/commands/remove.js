import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";
import { GuildDataManager } from "../events/reply.js";
import { addLogEntry } from "../services/logs.js";

const CONSTANTS = {
	SUCCESS_COLOR: "#A1DD70",
	ERROR_COLOR: "#EE4E4E",
	ERROR_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif",
	SUCCESS_THUMBNAIL:
		"https://media.discordapp.net/attachments/1057244827688910850/1110552199450333204/discord.gif"
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

export default {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("remove vocabulary for server")
		.setNameLocalizations({ "zh-TW": "刪除" })
		.setDescriptionLocalizations({ "zh-TW": "為伺服器刪除詞彙" })
		.addStringOption(option =>
			option
				.setName("trigger")
				.setDescription("Vocabulary to delete")
				.setNameLocalizations({ "zh-TW": "詞彙" })
				.setDescriptionLocalizations({ "zh-TW": "想要刪除的詞彙" })
				.setAutocomplete(true)
				.setRequired(true)
		),

	/**
	 * Execute the remove command
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 * @param {Object} db Database instance
	 */
	async execute(client, interaction, args, db) {
		try {
			const triggerToRemove = interaction.options.getString("trigger");

			// Get current data before deletion
			let guilddb =
				(await db.get(`${interaction.guild.id}.replies`)) || [];
			const triggerData = guilddb.find(
				entry => entry.trigger === triggerToRemove
			);

			if (!triggerData) {
				return interaction.reply({
					embeds: [createErrorEmbed("找不到此觸發詞")],
					ephemeral: true
				});
			}

			// Remove the trigger
			guilddb = guilddb.filter(
				entry => entry.trigger !== triggerToRemove
			);
			await db.set(`${interaction.guild.id}.replies`, guilddb);

			// Update cache
			GuildDataManager.updateCache(interaction.guild.id, guilddb);

			// Log the deletion
			await addLogEntry(interaction.guild, interaction.user, "delete", {
				trigger: triggerToRemove,
				replies: triggerData.replies,
				type: triggerData.type,
				mode: triggerData.mode,
				probability: triggerData.probability
			});

			// Send success message
			const successEmbed = new EmbedBuilder()
				.setColor(CONSTANTS.SUCCESS_COLOR)
				.setThumbnail(CONSTANTS.SUCCESS_THUMBNAIL)
				.setTitle("已刪除觸發詞")
				.addFields([
					{
						name: "觸發詞",
						value: triggerToRemove,
						inline: false
					}
				]);

			await interaction.reply({
				embeds: [successEmbed],
				ephemeral: true
			});
		} catch (error) {
			console.error("Remove command error:", error);
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
						)
						.setTitle("刪除詞彙時發生錯誤！")
						.setColor("#EE4E4E")
				],
				ephemeral: true
			});
		}
	}
};
