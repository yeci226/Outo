import { client } from "../index.js";
import { EmbedBuilder } from "discord.js";
import { QuickDB } from "quick.db";

const db = new QuickDB();

client.on("interactionCreate", async interaction => {
	if (!interaction.isModalSubmit() || interaction.customId !== "add") return;

	const trigger = interaction.fields
		.getTextInputValue("add_trigger")
		.replace(/\n/g, "");
	const replies = interaction.fields
		.getTextInputValue("add_reply")
		.replace(/\n/g, "")
		.split("</>");
	const type = interaction.fields.getTextInputValue("add_type");
	const mode = interaction.fields.getTextInputValue("add_mode");

	if (
		replies.some(
			reply => reply.includes("@everyone") || reply.includes("@here")
		)
	) {
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					)
					.setTitle("嘿！這是禁止的詞彙")
					.setColor("#EE4E4E")
			],
			ephemeral: true
		});
	}

	if (type !== "包含" && type !== "相同") {
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					)
					.setTitle("請確定輸入的類型為 `包含` 或者 `相同`")
					.setDescription("你輸入的是 `" + type + "`")
					.setColor("#EE4E4E")
			],
			ephemeral: true
		});
	}

	if (type !== "包含" && type !== "相同")
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					)
					.setTitle("請確定輸入回覆的類型為 `包含` 或者 `相同`")
					.setColor("#EE4E4E")
			],
			ephemeral: true
		});

	if (mode !== "回覆" && mode !== "訊息")
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setThumbnail(
						"https://media.discordapp.net/attachments/1057244827688910850/1110552508369219584/discord_1.gif"
					)
					.setTitle("請確定輸入發送訊息類型為 `回覆` 或者 `訊息`")
					.setDescription("你輸入的是 `" + mode + "`")
					.setColor("#EE4E4E")
			],
			ephemeral: true
		});

	let guilddb = (await db.get(`${interaction.guild.id}.replies`)) || [];
	const entry = { trigger, replies, type, mode };
	const index = guilddb.findIndex(e => e.trigger === trigger);

	if (index !== -1) guilddb[index] = entry;
	else guilddb.push(entry);

	await db.set(`${interaction.guild.id}.replies`, guilddb);

	interaction.reply({
		embeds: [
			new EmbedBuilder()
				.setColor("#A1DD70")
				.setThumbnail(
					"https://media.discordapp.net/attachments/1057244827688910850/1110552199450333204/discord.gif"
				)
				.setTitle("已添加新詞彙")
				.addFields(
					{
						name: "觸發詞",
						value: `\`${trigger.length > 2048 ? trigger.slice(0, 2048 - 3 - 4) + "..." : trigger}\``,
						inline: false
					},
					{
						name: "回覆",
						value: `${replies.join("\n").length > 2048 ? replies.join("\n").slice(0, 2048 - 3) + "..." : replies.join("\n")}`,
						inline: false
					},
					{ name: "觸發類型", value: `\`${type}\``, inline: false },
					{
						name: "發送訊息類型",
						value: `\`${mode}\``,
						inline: false
					}
				)
		],
		ephemeral: true
	});
});
