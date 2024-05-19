import { client } from "../index.js";
import {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder
} from "discord.js";
import moment from "moment";
const emoji = client.emoji;

function getLists(guilddb) {
	const chunkSize = 8;
	const listFullMap = guilddb.map((index, i) => {
		const trigger = index.trigger;
		const replies = index.replies;
		const type = index.type;
		const mode = index.mode;

		return {
			trigger: `${emoji.dot} **${
				trigger.length > 2000
					? trigger.slice(0, 2000 - 3 - 4) + "..."
					: trigger
			}**`,
			reply: replies
				.map(
					reply =>
						`${
							reply.length > 2048
								? reply.slice(
										0,
										Math.floor(2048 / replies.length) - 3
									) + "..."
								: reply
						}`
				)
				.join("\n"),
			type: type,
			mode: mode
		};
	});

	const totalPages = Array.from(
		{ length: Math.ceil(listFullMap.length / chunkSize) },
		(_, i) => listFullMap.slice(i * chunkSize, (i + 1) * chunkSize)
	);

	return { totalPages };
}

function getListEmbed(interaction, guilddb, totalPages, currentPage) {
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
			text: `${currentPage + 1}/${totalPages.length}\t ▪\t${moment(new Date()).format("YYYY-MM-DD HH:mm:ss")}`
		})
		.addField(
			`${emoji.dot} **\`觸發詞\`**`,
			`${emoji.line1} \`回覆詞\`\n${emoji.line2} \`類型\`/\`模式\``,
			true
		)
		.setColor("#A4D0A4");

	totalPages[currentPage].forEach(field => {
		const trigger = field.trigger;
		const reply = field.reply;
		const type = field.type;
		const mode = field.mode;

		embed.addField(
			`${trigger.length > 256 ? trigger.slice(0, 256 - 3) + "..." : trigger}`,
			`${reply.length > 2020 ? reply.slice(0, 2020 - 3) + "..." : reply}\n\`${type}\`/\`${mode}\``,
			true
		);
	});

	return embed;
}

function getListComponents(totalPages) {
	return [
		new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`listBack`)
				.setEmoji("⬅")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(totalPages.length === 1),
			new ButtonBuilder()
				.setCustomId(`listRefresh`)
				.setEmoji("🔄")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(`listNext`)
				.setEmoji("➡")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(totalPages.length === 1)
		)
	];
}

export { getLists, getListEmbed, getListComponents };
