import { client } from "../index.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Events, EmbedBuilder, WebhookClient, ChannelType } from "discord.js";
import { Logger } from "../services/logger.js";

const emoji = client.emoji;
const db = client.db;
const webhook = new WebhookClient({ url: process.env.CMDWEBHOOK });

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.channel.type == ChannelType.DM) return;

	if (interaction.isAutocomplete()) {
		if (interaction.options._hoistedOptions[0].name === "vocabulary") {
			const guilddb = await db.get(`${interaction.guild.id}.replies`);

			if (!guilddb) return;
			const visibleOptions = [];
			const input =
				interaction.options.getString("vocabulary", true) || "";

			const triggers = guilddb.map(e => e.trigger);
			const filteredTriggers = triggers
				.filter(trigger => trigger.includes(input))
				.slice(0, 25);

			filteredTriggers.map((trigger, index) => {
				visibleOptions.push({
					name: `${
						trigger.length > 100
							? trigger.slice(0, 100 - 3) + "..."
							: trigger
					}`,
					value: index.toString()
				});
			});

			await interaction.respond(visibleOptions);
		}
	}

	if (interaction.isButton()) {
		await interaction.deferUpdate().catch(() => {});
	}

	if (interaction.isCommand()) {
		const command = client.commands.slash.get(interaction.commandName);
		if (!command)
			return interaction.followUp({
				content: "An error has occured",
				ephemeral: true
			});

		const args = [];

		for (let option of interaction.options.data) {
			if (option.type === ApplicationCommandOptionType.Subcommand) {
				if (option.name) args.push(option.name);
				option.options?.forEach(x => {
					if (x.value) args.push(x.value);
				});
			} else if (option.value) args.push(option.value);
		}

		try {
			command.execute(client, interaction, args, db, emoji);

			const time = `花費 ${(
				(Date.now() - interaction.createdTimestamp) /
				1000
			).toFixed(2)} 秒`;

			new Logger("指令").command(
				`${interaction.user.displayName}(${interaction.user.id}) 執行 ${command.data.name} - ${time}`
			);
			webhook.send({
				embeds: [
					new EmbedBuilder()
						.setConfig(null, time)
						.setTimestamp()
						.setAuthor({
							iconURL: interaction.user.displayAvatarURL({
								size: 4096,
								dynamic: true
							}),
							name: `${interaction.user.username} - ${interaction.user.id}`
						})
						.setThumbnail(
							interaction.guild.iconURL({
								size: 4096,
								dynamic: true
							})
						)
						.setDescription(
							`\`\`\`${interaction.guild.name} - ${interaction.guild.id}\`\`\``
						)
						.addField(
							command.data.name,
							`${
								interaction.options._subcommand
									? `> ${interaction.options._subcommand}`
									: "\u200b"
							} ${
								interaction.options._hoistedOptions > 0
									? ` \`${interaction.options._hoistedOptions[0].value}\``
									: "\u200b"
							}`,
							true
						)
				]
			});
		} catch (e) {
			new Logger("指令").error(`錯誤訊息：${e.message}`);
			await interaction.reply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	} else if (interaction.isContextMenuCommand()) {
		const command = client.commands.slash.get(interaction.commandName);
		if (!command) return;
		try {
			command.execute(client, interaction);
		} catch (e) {
			new Logger("指令").error(`錯誤訊息：${e.message}`);
			await interaction.reply({
				content: "哦喲，好像出了一點小問題，請重試",
				ephemeral: true
			});
		}
	}
});
