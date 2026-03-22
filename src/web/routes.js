const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } = require('discord.js');
const { requireAuth } = require('./auth.js');
const logger = require('../logger.js');
const config = require('../config.js');
const { getWelcomeChannelId, setWelcomeChannelId } = require('../settings.js');
const store = require('../store.js');
const db = require('../db.js');

function getActiveGuildId(req) {
  return req.session.activeGuildId ?? config.guildId;
}

function setupRoutes(app, getClient) {
  app.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

  app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // ── Me (logged-in user info) ───────────────────────────────────────────────
  app.get('/api/me', requireAuth, (req, res) => {
    const client = getClient();
    const guildId = getActiveGuildId(req);
    const guild = client?.guilds.cache.get(guildId);
    res.json({
      tag: req.session.discordUser?.tag ?? 'Admin',
      avatar: req.session.discordUser?.avatar ?? null,
      userId: req.session.discordUser?.id ?? null,
      authMethod: req.session.authMethod ?? 'password',
      guildName: guild?.name ?? 'Unknown',
    });
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  app.get('/api/stats', requireAuth, (req, res) => {
    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    res.json({
      botTag: client?.user?.tag ?? 'Unknown',
      status: client?.isReady() ? 'online' : 'offline',
      uptimeMs: client?.uptime ?? 0,
      guildName: guild?.name ?? 'Unknown',
      memberCount: guild?.memberCount ?? 0,
      commandCount: client?.commands?.size ?? 0,
    });
  });

  // ── Logs ───────────────────────────────────────────────────────────────────
  app.get('/api/logs', requireAuth, (req, res) => {
    res.json(logger.getAll());
  });

  // ── Channels ───────────────────────────────────────────────────────────────
  app.get('/api/channels', requireAuth, (req, res) => {
    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    if (!guild) return res.status(503).json({ error: 'Guild not available' });

    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(channels);
  });

  // ── Roles ──────────────────────────────────────────────────────────────────
  app.get('/api/roles', requireAuth, (req, res) => {
    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    if (!guild) return res.status(503).json({ error: 'Guild not available' });

    const botHighest = guild.members.me?.roles.highest.position ?? 0;
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && r.position < botHighest)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(roles);
  });

  // ── Announce ───────────────────────────────────────────────────────────────
  app.post('/api/announce', requireAuth, async (req, res) => {
    const { title, description, date, channelId } = req.body;
    if (!title || !description || !channelId) {
      return res.status(400).json({ error: 'title, description, and channelId are required' });
    }

    const client = getClient();
    const channel = client?.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: 'Posted via BBots Dashboard' });

    if (date) embed.addFields({ name: 'Date / Time', value: date });

    await channel.send({ embeds: [embed] });
    logger.add('action', `Announcement "${title}" posted to #${channel.name} via dashboard`);
    res.json({ ok: true });
  });

  // ── Welcome ────────────────────────────────────────────────────────────────
  app.post('/api/welcome', requireAuth, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    if (!guild) return res.status(503).json({ error: 'Guild not available' });

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return res.status(404).json({ error: 'User not found in this server' });
    }

    const channel = guild.channels.cache.get(getWelcomeChannelId());
    if (!channel) return res.status(404).json({ error: 'Welcome channel not configured or not found' });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Welcome!')
      .setDescription(`Welcome to **${guild.name}**, ${member.user}! Glad to have you here.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: 'Welcomed via BBots Dashboard' });

    await channel.send({ embeds: [embed] });
    logger.add('action', `Welcome message sent for ${member.user.tag} via dashboard`);
    res.json({ ok: true });
  });

  // ── Role management ────────────────────────────────────────────────────────
  app.post('/api/role', requireAuth, async (req, res) => {
    const { action, userId, roleId } = req.body;
    if (!action || !userId || !roleId) {
      return res.status(400).json({ error: 'action, userId, and roleId are required' });
    }
    if (action !== 'add' && action !== 'remove') {
      return res.status(400).json({ error: 'action must be "add" or "remove"' });
    }

    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    if (!guild) return res.status(503).json({ error: 'Guild not available' });

    const role = guild.roles.cache.get(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const botHighest = guild.members.me?.roles.highest.position ?? 0;
    if (role.position >= botHighest) {
      return res.status(403).json({ error: `Cannot manage role "${role.name}" — it is equal to or above my highest role` });
    }

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return res.status(404).json({ error: 'User not found in this server' });
    }

    if (action === 'add') {
      if (member.roles.cache.has(roleId)) {
        return res.status(409).json({ error: `${member.user.tag} already has the "${role.name}" role` });
      }
      await member.roles.add(role);
      logger.add('action', `Role "${role.name}" added to ${member.user.tag} via dashboard`);
    } else {
      if (!member.roles.cache.has(roleId)) {
        return res.status(409).json({ error: `${member.user.tag} does not have the "${role.name}" role` });
      }
      await member.roles.remove(role);
      logger.add('action', `Role "${role.name}" removed from ${member.user.tag} via dashboard`);
    }

    res.json({ ok: true });
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, (req, res) => {
    const client = getClient();
    const guildId = getActiveGuildId(req);
    const guildName = client?.guilds.cache.get(guildId)?.name ?? null;
    res.json({
      guildId,
      guildName,
      welcomeChannelId:         getWelcomeChannelId(),
      logChannelId:             store.get('logChannelId') ?? null,
      birthdayChannelId:        db.guildGet(guildId, 'birthdayChannelId') ?? null,
      xpAnnouncementsChannelId: db.guildGet(guildId, 'xpAnnouncementsChannelId') ?? null,
    });
  });

  app.post('/api/settings', requireAuth, (req, res) => {
    const { welcomeChannelId, logChannelId, birthdayChannelId, xpAnnouncementsChannelId } = req.body;
    const guildId = getActiveGuildId(req);
    if (welcomeChannelId !== undefined) {
      setWelcomeChannelId(welcomeChannelId);
      logger.add('info', `Welcome channel updated to ${welcomeChannelId || 'none'} via dashboard`);
    }
    if (logChannelId !== undefined) {
      store.set('logChannelId', logChannelId || null);
      logger.add('info', `Log channel updated to ${logChannelId || 'none'} via dashboard`);
    }
    if (birthdayChannelId !== undefined) {
      db.guildSet(guildId, 'birthdayChannelId', birthdayChannelId || null);
    }
    if (xpAnnouncementsChannelId !== undefined) {
      db.guildSet(guildId, 'xpAnnouncementsChannelId', xpAnnouncementsChannelId || null);
    }
    res.json({ ok: true });
  });

  // ── Reaction roles ─────────────────────────────────────────────────────────
  app.get('/api/reaction-roles', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const all = store.get('reactionRoles') ?? [];
    res.json(all.filter(r => r.guildId === guildId));
  });

  app.post('/api/reaction-roles', requireAuth, async (req, res) => {
    const { channelId, messageId, createMessage, messageText, emoji, roleId } = req.body;
    if (!channelId || !emoji || !roleId) {
      return res.status(400).json({ error: 'channelId, emoji, and roleId are required' });
    }
    if (!createMessage && !messageId) {
      return res.status(400).json({ error: 'messageId is required when not creating a new message' });
    }

    const client = getClient();
    const guild = client?.guilds.cache.get(getActiveGuildId(req));
    if (!guild) return res.status(503).json({ error: 'Guild not available' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    let targetMessageId = messageId;

    try {
      if (createMessage) {
        if (!messageText) return res.status(400).json({ error: 'messageText is required when creating a new message' });
        const posted = await channel.send(messageText);
        targetMessageId = posted.id;
      } else {
        await channel.messages.fetch(targetMessageId);
      }
    } catch {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Add bot reaction so users know what to click
    try {
      const msg = await channel.messages.fetch(targetMessageId);
      await msg.react(emoji);
    } catch {
      // Emoji may be invalid — continue anyway; don't block saving
    }

    const all = store.get('reactionRoles') ?? [];
    const existing = all.find(r => r.messageId === targetMessageId);

    if (existing) {
      const alreadyHas = existing.rules.some(r => r.emoji === emoji);
      if (!alreadyHas) existing.rules.push({ emoji, roleId });
      store.set('reactionRoles', all);
    } else {
      all.push({
        id: crypto.randomUUID(),
        guildId: guild.id,
        channelId,
        messageId: targetMessageId,
        rules: [{ emoji, roleId }],
      });
      store.set('reactionRoles', all);
    }

    logger.add('action', `Reaction role set up on message ${targetMessageId} in #${channel.name}`);
    res.json({ ok: true, messageId: targetMessageId });
  });

  app.delete('/api/reaction-roles/:id', requireAuth, (req, res) => {
    const all = store.get('reactionRoles') ?? [];
    const filtered = all.filter(r => r.id !== req.params.id);
    store.set('reactionRoles', filtered);
    res.json({ ok: true });
  });

  // ── Auto roles ─────────────────────────────────────────────────────────────
  app.get('/api/auto-roles', requireAuth, (req, res) => {
    res.json(store.get('autoRoles') ?? { immediate: [], delayed: [] });
  });

  app.post('/api/auto-roles', requireAuth, (req, res) => {
    const { immediate, delayed } = req.body;
    store.set('autoRoles', {
      immediate: Array.isArray(immediate) ? immediate : [],
      delayed: Array.isArray(delayed) ? delayed : [],
    });
    logger.add('action', 'Auto-role config updated via dashboard');
    res.json({ ok: true });
  });

  // ── Embed builder ──────────────────────────────────────────────────────────
  app.post('/api/embed', requireAuth, async (req, res) => {
    const { channelId, title, description, color, footer, imageUrl, thumbnailUrl } = req.body;
    if (!channelId || !description) {
      return res.status(400).json({ error: 'channelId and description are required' });
    }

    const client = getClient();
    const channel = client?.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const embed = new EmbedBuilder().setDescription(description);

    if (title)        embed.setTitle(title);
    if (color)        embed.setColor(color);
    if (footer)       embed.setFooter({ text: footer });
    if (imageUrl)     embed.setImage(imageUrl);
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

    await channel.send({ embeds: [embed] });
    logger.add('action', `Custom embed sent to #${channel.name} via dashboard`);
    res.json({ ok: true });
  });

  // ── Deploy slash commands ───────────────────────────────────────────────────
  app.post('/api/deploy', requireAuth, async (req, res) => {
    const { DISCORD_TOKEN, CLIENT_ID } = process.env;
    if (!DISCORD_TOKEN || !CLIENT_ID) {
      return res.status(500).json({ error: 'DISCORD_TOKEN or CLIENT_ID missing from .env' });
    }
    const guildId = getActiveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'No active guild — select a server first' });
    }

    try {
      const commands = [];
      function loadCommands(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) loadCommands(path.join(dir, entry.name));
          else if (entry.name.endsWith('.js')) {
            const cmd = require(path.join(dir, entry.name));
            if ('data' in cmd && 'execute' in cmd) commands.push(cmd.data.toJSON());
          }
        }
      }
      loadCommands(path.join(__dirname, '..', 'commands'));

      const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
      const data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, guildId),
        { body: commands }
      );
      logger.add('action', `Deployed ${data.length} slash command(s) to guild ${guildId} via dashboard`);
      res.json({ ok: true, count: data.length });
    } catch (err) {
      console.error('[Deploy]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Feature flags ───────────────────────────────────────────────────────────
  app.get('/api/features', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    res.json(db.getAllFlags(guildId));
  });

  app.post('/api/features', requireAuth, (req, res) => {
    const { feature, enabled } = req.body;
    if (!feature || enabled === undefined) {
      return res.status(400).json({ error: 'feature and enabled are required' });
    }
    if (!db.ALL_FEATURES.includes(feature)) {
      return res.status(400).json({ error: 'Unknown feature' });
    }
    const guildId = getActiveGuildId(req);
    db.setEnabled(guildId, feature, !!enabled);
    logger.add('info', `Feature "${feature}" ${enabled ? 'enabled' : 'disabled'} via dashboard`);
    res.json({ ok: true });
  });

  // ── Auto-responders ─────────────────────────────────────────────────────────
  app.get('/api/auto-responders', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const rows = db.db.prepare('SELECT * FROM auto_responders WHERE guild_id = ?').all(guildId);
    res.json(rows);
  });

  app.post('/api/auto-responders', requireAuth, (req, res) => {
    const { trigger, response, match_type = 'contains' } = req.body;
    if (!trigger || !response) {
      return res.status(400).json({ error: 'trigger and response are required' });
    }
    if (!['exact', 'contains', 'startswith'].includes(match_type)) {
      return res.status(400).json({ error: 'match_type must be exact, contains, or startswith' });
    }
    const guildId = getActiveGuildId(req);
    const id = crypto.randomUUID();
    db.db.prepare('INSERT INTO auto_responders (id, guild_id, trigger, response, match_type) VALUES (?, ?, ?, ?, ?)')
      .run(id, guildId, trigger, response, match_type);
    logger.add('action', `Auto-responder added: "${trigger}" via dashboard`);
    res.json({ ok: true, id });
  });

  app.delete('/api/auto-responders/:id', requireAuth, (req, res) => {
    db.db.prepare('DELETE FROM auto_responders WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── Scheduled announcements ─────────────────────────────────────────────────
  app.get('/api/scheduled-announcements', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const rows = db.db.prepare('SELECT * FROM scheduled_announcements WHERE guild_id = ?').all(guildId);
    res.json(rows);
  });

  app.post('/api/scheduled-announcements', requireAuth, (req, res) => {
    const { channelId, message, cron } = req.body;
    if (!channelId || !message || !cron) {
      return res.status(400).json({ error: 'channelId, message, and cron are required' });
    }
    const guildId = getActiveGuildId(req);
    const id = crypto.randomUUID();
    db.db.prepare('INSERT INTO scheduled_announcements (id, guild_id, channel_id, message, cron) VALUES (?, ?, ?, ?, ?)')
      .run(id, guildId, channelId, message, cron);
    // Reload scheduler
    try { require('../scheduler.js').reload(); } catch { /* scheduler not loaded yet */ }
    logger.add('action', `Scheduled announcement added (cron: ${cron}) via dashboard`);
    res.json({ ok: true, id });
  });

  app.delete('/api/scheduled-announcements/:id', requireAuth, (req, res) => {
    db.db.prepare('DELETE FROM scheduled_announcements WHERE id = ?').run(req.params.id);
    try { require('../scheduler.js').reload(); } catch { /* ignore */ }
    res.json({ ok: true });
  });

  // ── Role menus ──────────────────────────────────────────────────────────────
  app.get('/api/role-menus', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const menus = db.db.prepare('SELECT * FROM role_menus WHERE guild_id = ?').all(guildId);
    for (const menu of menus) {
      menu.buttons = db.db.prepare('SELECT * FROM role_menu_buttons WHERE menu_id = ?').all(menu.id);
    }
    res.json(menus);
  });

  app.delete('/api/role-menus/:id', requireAuth, async (req, res) => {
    const menu = db.db.prepare('SELECT * FROM role_menus WHERE id = ?').get(req.params.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });

    // Delete Discord message if possible
    if (menu.message_id) {
      try {
        const client = getClient();
        const channel = client?.channels.cache.get(menu.channel_id);
        const msg = await channel?.messages.fetch(menu.message_id).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      } catch { /* ignore */ }
    }

    db.db.prepare('DELETE FROM role_menu_buttons WHERE menu_id = ?').run(req.params.id);
    db.db.prepare('DELETE FROM role_menus WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── XP leaderboard (read-only for dashboard) ────────────────────────────────
  app.get('/api/xp-leaderboard', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const rows = db.db.prepare(
      'SELECT user_id, xp, level FROM xp WHERE guild_id = ? ORDER BY xp DESC LIMIT 20'
    ).all(guildId);
    res.json(rows);
  });

  // ── Notification feeds ──────────────────────────────────────────────────────
  app.get('/api/notification-feeds', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const rows = db.db.prepare('SELECT * FROM notification_feeds WHERE guild_id = ?').all(guildId);
    res.json(rows);
  });

  app.post('/api/notification-feeds', requireAuth, (req, res) => {
    const { channelId, type, source, role_ping } = req.body;
    if (!channelId || !type || !source) {
      return res.status(400).json({ error: 'channelId, type, and source are required' });
    }
    if (!['twitch', 'youtube', 'rss'].includes(type)) {
      return res.status(400).json({ error: 'type must be twitch, youtube, or rss' });
    }
    const guildId = getActiveGuildId(req);
    const id = crypto.randomUUID();
    db.db.prepare('INSERT INTO notification_feeds (id, guild_id, channel_id, type, source, role_ping) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, guildId, channelId, type, source, role_ping ?? null);
    logger.add('action', `Notification feed added: ${type}/${source} via dashboard`);
    res.json({ ok: true, id });
  });

  app.delete('/api/notification-feeds/:id', requireAuth, (req, res) => {
    db.db.prepare('DELETE FROM notification_feeds WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── AI settings ────────────────────────────────────────────────────────────
  app.get('/api/ai-settings', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    res.json({
      provider:     db.guildGet(guildId, 'aiProvider')     ?? 'openai',
      model:        db.guildGet(guildId, 'aiModel')        ?? '',
      systemPrompt: db.guildGet(guildId, 'aiSystemPrompt') ?? '',
      aiChannelId:  db.guildGet(guildId, 'aiChannelId')    ?? '',
    });
  });

  // ── Custom commands ─────────────────────────────────────────────────────────
  app.get('/api/prefix', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    res.json({ prefix: db.guildGet(guildId, 'prefix') ?? '!' });
  });

  app.post('/api/prefix', requireAuth, (req, res) => {
    const { prefix } = req.body;
    if (!prefix || typeof prefix !== 'string' || prefix.length > 5) {
      return res.status(400).json({ error: 'Prefix must be 1–5 characters' });
    }
    const guildId = getActiveGuildId(req);
    db.guildSet(guildId, 'prefix', prefix.trim());
    logger.add('info', `Prefix set to "${prefix.trim()}" via dashboard`);
    res.json({ ok: true });
  });

  app.get('/api/custom-commands', requireAuth, (req, res) => {
    const guildId = getActiveGuildId(req);
    const rows = db.db.prepare('SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY name').all(guildId);
    res.json(rows);
  });

  app.post('/api/custom-commands', requireAuth, (req, res) => {
    const { name, response } = req.body;
    if (!name || !response) return res.status(400).json({ error: 'name and response are required' });
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    const guildId = getActiveGuildId(req);
    const id = crypto.randomUUID();
    try {
      db.db.prepare('INSERT INTO custom_commands (id, guild_id, name, response) VALUES (?, ?, ?, ?)')
        .run(id, guildId, cleanName, response.trim());
      logger.add('action', `Custom command !${cleanName} added via dashboard`);
      res.json({ ok: true, id });
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: `Command "${cleanName}" already exists` });
      throw err;
    }
  });

  app.delete('/api/custom-commands/:id', requireAuth, (req, res) => {
    db.db.prepare('DELETE FROM custom_commands WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/ai-settings', requireAuth, (req, res) => {
    const { provider, model, systemPrompt, aiChannelId } = req.body;
    const guildId = getActiveGuildId(req);
    if (provider !== undefined)     db.guildSet(guildId, 'aiProvider',     provider);
    if (model !== undefined)        db.guildSet(guildId, 'aiModel',        model);
    if (systemPrompt !== undefined) db.guildSet(guildId, 'aiSystemPrompt', systemPrompt);
    if (aiChannelId !== undefined)  db.guildSet(guildId, 'aiChannelId',    aiChannelId);
    logger.add('info', 'AI settings updated via dashboard');
    res.json({ ok: true });
  });
}

module.exports = { setupRoutes };
