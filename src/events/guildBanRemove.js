const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { postLog } = require('../log-channel.js');

module.exports = {
  name: Events.GuildBanRemove,
  once: false,
  async execute(ban) {
    let moderatorTag = null;

    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = logs.entries.first();
      if (entry?.target?.id === ban.user.id) {
        moderatorTag = entry.executor?.tag ?? null;
      }
    } catch { /* No audit log permission — skip */ }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL({ dynamic: true }) })
      .setTitle('Member Unbanned')
      .addFields({ name: 'User', value: `${ban.user} (${ban.user.id})` });

    if (moderatorTag) embed.addFields({ name: 'Unbanned by', value: moderatorTag });
    embed.setTimestamp();

    await postLog(ban.guild, embed);
  },
};
