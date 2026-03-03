const { Events, EmbedBuilder } = require('discord.js');
const { welcomeChannelId } = require('../config.js');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    const channel = member.guild.channels.cache.get(welcomeChannelId);

    if (!channel) {
      console.warn(`[WARN] Welcome channel ${welcomeChannelId} not found in guild "${member.guild.name}"`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Welcome to the server!')
      .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! We're glad you're here.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  },
};
