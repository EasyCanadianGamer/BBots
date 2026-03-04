const store = require('./store.js');

/**
 * Posts an embed to the configured audit log channel for the guild.
 * Silently does nothing if no log channel is configured or accessible.
 */
async function postLog(guild, embed) {
  const channelId = store.get('logChannelId');
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { postLog };
