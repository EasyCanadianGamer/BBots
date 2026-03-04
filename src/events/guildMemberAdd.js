const { Events, EmbedBuilder } = require('discord.js');
const { getWelcomeChannelId } = require('../settings.js');
const logger = require('../logger.js');
const store = require('../store.js');
const { postLog } = require('../log-channel.js');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    // ── Audit log ─────────────────────────────────────────────────────────
    logger.add('join', `${member.user.tag} joined ${member.guild.name} (member #${member.guild.memberCount})`);
    await postLog(member.guild, new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
      .setTitle('Member Joined')
      .addFields({ name: 'User', value: `${member.user} (${member.id})` })
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp()
    );

    // ── Welcome message ───────────────────────────────────────────────────
    const welcomeChannelId = getWelcomeChannelId();
    if (welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcomeChannelId);
      if (!channel) {
        console.warn(`[WARN] Welcome channel ${welcomeChannelId} not found in guild "${member.guild.name}"`);
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Welcome to the server!')
          .setDescription(`Hey ${member}, welcome to **${member.guild.name}**! We're glad you're here.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: `Member #${member.guild.memberCount}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    // ── Auto roles ────────────────────────────────────────────────────────
    const autoRoles = store.get('autoRoles');
    if (!autoRoles) return;

    for (const roleId of autoRoles.immediate ?? []) {
      await member.roles.add(roleId).catch(err =>
        console.warn(`[AUTO-ROLE] Failed to add immediate role ${roleId}:`, err.message)
      );
    }

    for (const { roleId, delayMinutes } of autoRoles.delayed ?? []) {
      setTimeout(async () => {
        const m = await member.guild.members.fetch(member.id).catch(() => null);
        if (!m) return;
        await m.roles.add(roleId).catch(err =>
          console.warn(`[AUTO-ROLE] Failed to add delayed role ${roleId}:`, err.message)
        );
      }, (delayMinutes ?? 0) * 60_000);
    }
  },
};
