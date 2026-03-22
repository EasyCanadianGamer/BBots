const { Events, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const ai = require('../ai.js');

// XP formula matching MEE6: level = floor(0.1 * sqrt(totalXp))
function xpToLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

// XP needed to reach a level
function levelToXp(level) {
  return Math.pow(level / 0.1, 2);
}

// Resolve @Name patterns to Discord mentions in custom command responses
async function resolveMentions(text, guild) {
  const matches = [...text.matchAll(/@([^\s@#]+)/g)];
  for (const [match, name] of matches) {
    // Raw numeric ID — convert directly
    if (/^\d{17,20}$/.test(name)) {
      text = text.replace(match, `<@${name}>`);
      continue;
    }
    const lower = name.toLowerCase();
    // Try roles first (always cached)
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === lower);
    if (role) { text = text.replace(match, `<@&${role.id}>`); continue; }
    // Try member cache, then fetch from API if not found
    let member = guild.members.cache.find(m =>
      m.user.username.toLowerCase() === lower ||
      m.displayName.toLowerCase() === lower
    );
    if (!member) {
      try {
        const results = await guild.members.fetch({ query: lower, limit: 1 });
        const found = results.first();
        if (
          found?.user.username.toLowerCase() === lower ||
          found?.displayName.toLowerCase() === lower
        ) member = found;
      } catch { /* ignore fetch errors */ }
    }
    if (member) text = text.replace(match, `<@${member.id}>`);
  }
  return text;
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const content = message.content.toLowerCase();

    // ── Custom prefix commands ───────────────────────────────────────────────
    if (db.isEnabled(guildId, 'custom_commands')) {
      const prefix = db.guildGet(guildId, 'prefix') ?? '!';
      if (message.content.startsWith(prefix)) {
        const cmdName = message.content.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
        if (cmdName) {
          const cmd = db.db
            .prepare('SELECT response FROM custom_commands WHERE guild_id = ? AND name = ?')
            .get(guildId, cmdName);
          if (cmd) {
            const resolved = await resolveMentions(cmd.response, message.guild);
            await message.channel.send({ content: resolved, allowedMentions: { parse: ['roles', 'users'] } }).catch(() => null);
            return;
          }
        }
      }
    }

    // ── Auto-responder ──────────────────────────────────────────────────────
    if (db.isEnabled(guildId, 'auto_responder')) {
      const responders = db.db
        .prepare('SELECT * FROM auto_responders WHERE guild_id = ?')
        .all(guildId);

      for (const ar of responders) {
        const trigger = ar.trigger.toLowerCase();
        let matched = false;
        if (ar.match_type === 'exact')      matched = content === trigger;
        else if (ar.match_type === 'startswith') matched = content.startsWith(trigger);
        else                                 matched = content.includes(trigger);

        if (matched) {
          await message.channel.send(ar.response).catch(() => null);
          break; // only fire first match
        }
      }
    }

    // ── XP ──────────────────────────────────────────────────────────────────
    if (db.isEnabled(guildId, 'xp')) {
      const userId = message.author.id;
      const now = Date.now();
      const COOLDOWN_MS = 60_000;

      const row = db.db
        .prepare('SELECT xp, level, last_message_at FROM xp WHERE guild_id = ? AND user_id = ?')
        .get(guildId, userId);

      const lastAt = row?.last_message_at ?? 0;
      if (now - lastAt >= COOLDOWN_MS) {

      const earned = Math.floor(Math.random() * 11) + 15; // 15–25 XP
      const newXp = (row?.xp ?? 0) + earned;
      const newLevel = xpToLevel(newXp);
      const oldLevel = row?.level ?? 0;

      db.db.prepare(
        `INSERT INTO xp (guild_id, user_id, xp, level, last_message_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
           xp = excluded.xp,
           level = excluded.level,
           last_message_at = excluded.last_message_at`
      ).run(guildId, userId, newXp, newLevel, now);

      // Announce level-up
      if (newLevel > oldLevel) {
        const announceChannelId = db.guildGet(guildId, 'xpAnnouncementsChannelId');
        const channel = announceChannelId
          ? message.guild.channels.cache.get(announceChannelId)
          : message.channel;

        if (channel) {
          const nextLevelXp = levelToXp(newLevel + 1);
          const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Level Up!')
            .setDescription(`${message.author} reached **Level ${newLevel}**! 🎉`)
            .addFields({ name: 'XP to next level', value: `${newXp} / ${Math.floor(nextLevelXp)}` })
            .setThumbnail(message.author.displayAvatarURL())
            .setTimestamp();
          channel.send({ embeds: [embed] }).catch(() => null);
        }
      }
      } // end cooldown check
    }

    // ── AI chat ─────────────────────────────────────────────────────────────
    if (db.isEnabled(guildId, 'ai')) {
      const aiChannelId  = db.guildGet(guildId, 'aiChannelId');
      const isMentioned  = message.mentions.has(message.client.user);
      const isAiChannel  = aiChannelId && message.channel.id === aiChannelId;

      if (isMentioned || isAiChannel) {
        // Strip the bot mention from the message content
        const userText = message.content
          .replace(/<@!?\d+>/g, '')
          .trim();

        if (!userText) return;

        const provider     = db.guildGet(guildId, 'aiProvider')     ?? 'openai';
        const model        = db.guildGet(guildId, 'aiModel')        ?? null;
        const systemPrompt = db.guildGet(guildId, 'aiSystemPrompt') ?? null;

        try {
          await message.channel.sendTyping().catch(() => null);
          const reply = await ai.chat(message.channel.id, userText, {
            provider,
            model:        model || undefined,
            systemPrompt: systemPrompt || undefined,
          });
          await message.reply(reply);
        } catch (err) {
          await message.reply(`⚠️ AI error: ${err.message}`).catch(() => null);
        }
      }
    }
  },
};
