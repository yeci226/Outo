import { client } from "../index.js";
import { ChannelType } from "discord.js";
import { QuickDB } from "quick.db";
const db = new QuickDB();

client.on("messageCreate", async message => {
	if (
		message.author.bot ||
		message.system ||
		message.channel.type === ChannelType.DM
	)
		return;

	const guilddb = await db.get(`${message.guild.id}.replies`);
	const content = message.content;

	if (guilddb) {
		const matchedEntry = guilddb.find(
			e =>
				(e.type === "相同" && e.trigger === content) ||
				(e.type === "包含" && content.includes(e.trigger))
		);

		if (matchedEntry) {
			const { trigger, type, replies, mode } = matchedEntry;

			if (
				(type === "相同" && content === trigger) ||
				(type === "包含" && content.includes(trigger))
			) {
				const randomIndex = Math.floor(Math.random() * replies.length);
				const reply = replies[randomIndex];

				if (mode === "訊息")
					message.channel.send({ content: reply }).catch(() => {});
				else message.reply({ content: reply }).catch(() => {});
			}
		}
	}
});
