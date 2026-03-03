const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an event announcement to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('The announcement title')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('The announcement body text')
        .setRequired(true)
        .setMaxLength(4096)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Optional date/time for the event (e.g. "March 15 at 8 PM EST")')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to post in (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const date = interaction.options.getString('date');
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: `Announced by ${interaction.user.tag}` });

    if (date) {
      embed.addFields({ name: 'Date / Time', value: date });
    }

    await targetChannel.send({ embeds: [embed] });

    await interaction.reply({
      content: `Announcement posted to ${targetChannel}.`,
      ephemeral: true,
    });
  },
};
