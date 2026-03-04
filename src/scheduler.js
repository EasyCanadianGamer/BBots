const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const db = require('./db.js');

let _client = null;
const _tasks = new Map(); // id → cron task

function init(client) {
  _client = client;
  reload();
  scheduleBirthdays();
}

// ── Scheduled Announcements ───────────────────────────────────────────────────

function reload() {
  // Stop all running scheduled announcement tasks
  for (const [id, task] of _tasks) {
    task.stop();
    _tasks.delete(id);
  }

  const rows = db.db.prepare('SELECT * FROM scheduled_announcements').all();
  for (const row of rows) {
    if (!cron.validate(row.cron)) {
      console.warn(`[Scheduler] Invalid cron "${row.cron}" for announcement ${row.id}, skipping.`);
      continue;
    }
    const task = cron.schedule(row.cron, async () => {
      if (!db.isEnabled(row.guild_id, 'scheduled_announcements')) return;
      const channel = _client?.channels.cache.get(row.channel_id);
      if (!channel) return;
      await channel.send(row.message).catch(() => null);
    });
    _tasks.set(row.id, task);
  }

  console.log(`[Scheduler] Loaded ${_tasks.size} scheduled announcement(s).`);
}

// ── Birthdays ─────────────────────────────────────────────────────────────────

function scheduleBirthdays() {
  // Run every day at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day   = now.getUTCDate();

    const rows = db.db
      .prepare('SELECT guild_id, user_id FROM birthdays WHERE month = ? AND day = ?')
      .all(month, day);

    // Group by guild
    const byGuild = {};
    for (const row of rows) {
      (byGuild[row.guild_id] ??= []).push(row.user_id);
    }

    for (const [guildId, userIds] of Object.entries(byGuild)) {
      if (!db.isEnabled(guildId, 'birthdays')) continue;
      const channelId = db.guildGet(guildId, 'birthdayChannelId');
      if (!channelId) continue;
      const channel = _client?.channels.cache.get(channelId);
      if (!channel) continue;

      for (const userId of userIds) {
        const user = await _client.users.fetch(userId).catch(() => null);
        if (!user) continue;
        const embed = new EmbedBuilder()
          .setColor(0xFF73FA)
          .setTitle('🎂 Happy Birthday!')
          .setDescription(`Today is ${user}'s birthday! Wish them well! 🎉`)
          .setThumbnail(user.displayAvatarURL())
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    }
  });
}

module.exports = { init, reload };
