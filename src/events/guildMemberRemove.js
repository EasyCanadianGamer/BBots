const { Events, EmbedBuilder } = require('discord.js');
const { postLog } = require('../log-channel.js');
const logger = require('../logger.js');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    logger.add('join', `${member.user.tag} left ${member.guild.name}`);

    await postLog(member.guild, new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
      .setTitle('Member Left')
      .addFields({ name: 'User', value: `${member.user} (${member.id})` })
      .setFooter({ text: `${member.guild.memberCount} members remaining` })
      .setTimestamp()
    );
  },
};
