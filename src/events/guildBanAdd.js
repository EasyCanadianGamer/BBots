const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { postLog } = require('../log-channel.js');

module.exports = {
  name: Events.GuildBanAdd,
  once: false,
  async execute(ban) {
    let reason = ban.reason ?? 'No reason provided';
    let moderatorTag = null;

    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry?.target?.id === ban.user.id) {
        reason = entry.reason ?? reason;
        moderatorTag = entry.executor?.tag ?? null;
      }
    } catch { /* No audit log permission — skip */ }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL({ dynamic: true }) })
      .setTitle('Member Banned')
      .addFields(
        { name: 'User', value: `${ban.user} (${ban.user.id})` },
        { name: 'Reason', value: reason },
      );

    if (moderatorTag) embed.addFields({ name: 'Moderator', value: moderatorTag });
    embed.setTimestamp();

    await postLog(ban.guild, embed);
  },
};
