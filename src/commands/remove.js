import {
	CommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder
} from "discord.js";

export default {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("remove vocabulary for server")
		.setNameLocalizations({ "zh-TW": "刪除" })
		.setDescriptionLocalizations({ "zh-TW": "為伺服器刪除詞彙" })
		.addStringOption(option =>
			option
				.setName("vocabulary")
				.setDescription("Word to delete")
				.setNameLocalizations({ "zh-TW": "詞彙" })
				.setDescriptionLocalizations({ "zh-TW": "想要刪除的詞彙" })
				.setAutocomplete(true)
				.setRequired(true)
		),

	/**
	 *
	 * @param {Client} client
	 * @param {CommandInteraction} interaction
	 * @param {String[]} args
	 */
	async execute(client, interaction, args, db) {
		const guilddb = await db.get(`${interaction.guild.id}.replies`);
		if (!guilddb) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
						)
						.setTitle("我沒有在這個伺服器找到任何詞彙！")
						.setConfig("#EE4E4E")
				],
				ephemeral: true
			});
		}

		const trigger = interaction.options.getString("vocabulary");
		const index = guilddb.findIndex(e => e.trigger === trigger);

		if (index !== -1) {
			guilddb.splice(index, 1);
			await db.set(`${interaction.guild.id}`, { replies: guilddb });

			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setThumbnail(
							"https://media.discordapp.net/attachments/1057244827688910850/1110552199450333204/discord.gif"
						)
						.setTitle("已刪除詞彙")
						.addFields({
							name: "觸發詞",
							value: `\`${trigger.length > 2048 ? trigger.slice(0, 2048 - 3 - 4) + "..." : trigger}\``,
							inline: false
						})
						.setConfig("#A1DD70")
				],
				ephemeral: true
			});
		}

		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					)
					.setTitle("未找到可刪除的詞彙！")
					.setConfig("#EE4E4E")
			],
			ephemeral: true
		});
	}
};
