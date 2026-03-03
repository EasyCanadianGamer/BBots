const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { welcomeChannelId } = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manually send a welcome message to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to welcome')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');

    const channel = interaction.guild.channels.cache.get(welcomeChannelId);
    if (!channel) {
      return interaction.reply({
        content: 'Welcome channel is not configured correctly. Check `WELCOME_CHANNEL_ID` in your `.env`.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Welcome!')
      .setDescription(`Welcome to **${interaction.guild.name}**, ${targetUser}! Glad to have you here.`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: `Welcomed by ${interaction.user.tag}` });

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: `Welcome message sent for ${targetUser.tag} in ${channel}.`,
      ephemeral: true,
    });
  },
};
