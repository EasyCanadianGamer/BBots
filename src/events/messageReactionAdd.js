const { Events } = require('discord.js');
const store = require('../store.js');

module.exports = {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }

    const reactionRoles = store.get('reactionRoles') ?? [];
    const config = reactionRoles.find(r => r.messageId === reaction.message.id);
    if (!config) return;

    const emojiKey = reaction.emoji.id ?? reaction.emoji.name;
    const rule = config.rules.find(r => r.emoji === emojiKey || r.emoji === reaction.emoji.name);
    if (!rule) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    await member.roles.add(rule.roleId).catch(console.error);
  },
};
