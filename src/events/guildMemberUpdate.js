const { Events, EmbedBuilder } = require('discord.js');
const { postLog } = require('../log-channel.js');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,
  async execute(oldMember, newMember) {
    const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (!added.size && !removed.size) return;

    const fields = [{ name: 'Member', value: `${newMember.user} (${newMember.id})` }];
    if (added.size)   fields.push({ name: 'Roles Added',   value: added.map(r => r.toString()).join(', ') });
    if (removed.size) fields.push({ name: 'Roles Removed', value: removed.map(r => r.toString()).join(', ') });

    await postLog(newMember.guild, new EmbedBuilder()
      .setColor(0x89B4FA)
      .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL({ dynamic: true }) })
      .setTitle('Member Roles Updated')
      .addFields(fields)
      .setTimestamp()
    );
  },
};
