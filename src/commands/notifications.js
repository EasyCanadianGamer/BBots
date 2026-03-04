const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { randomUUID } = require('node:crypto');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notifications')
    .setDescription('Manage notification feeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a notification feed')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Feed type')
        .setRequired(true)
        .addChoices(
          { name: 'Twitch', value: 'twitch' },
          { name: 'YouTube', value: 'youtube' },
          { name: 'RSS', value: 'rss' }
        )
      )
      .addStringOption(opt => opt.setName('source').setDescription('Twitch username / YouTube channel ID / RSS URL').setRequired(true))
      .addChannelOption(opt => opt.setName('channel').setDescription('Discord channel to post notifications in').setRequired(true))
      .addRoleOption(opt => opt.setName('role_ping').setDescription('Role to ping (optional)'))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all notification feeds')
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a notification feed')
      .addStringOption(opt => opt.setName('feed_id').setDescription('Feed ID (from /notifications list)').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const type      = interaction.options.getString('type');
      const source    = interaction.options.getString('source');
      const channel   = interaction.options.getChannel('channel');
      const rolePing  = interaction.options.getRole('role_ping');
      const id = randomUUID();

      db.db.prepare(
        'INSERT INTO notification_feeds (id, guild_id, channel_id, type, source, role_ping) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, guildId, channel.id, type, source, rolePing?.id ?? null);

      return interaction.reply({
        content: `✅ **${type}** feed added for \`${source}\` → <#${channel.id}>\nFeed ID: \`${id}\``,
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const rows = db.db.prepare('SELECT * FROM notification_feeds WHERE guild_id = ?').all(guildId);
      if (!rows.length) return interaction.reply({ content: 'No notification feeds configured.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Notification Feeds')
        .setDescription(rows.map(r =>
          `\`${r.id.slice(0, 8)}\` **${r.type}** \`${r.source}\` → <#${r.channel_id}>${r.role_ping ? ` <@&${r.role_ping}>` : ''}`
        ).join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'remove') {
      const feedId = interaction.options.getString('feed_id');
      const feed = db.db.prepare('SELECT id FROM notification_feeds WHERE id LIKE ? AND guild_id = ?')
        .get(`${feedId}%`, guildId);
      if (!feed) return interaction.reply({ content: '❌ Feed not found.', ephemeral: true });
      db.db.prepare('DELETE FROM notification_feeds WHERE id = ?').run(feed.id);
      return interaction.reply({ content: '✅ Feed removed.', ephemeral: true });
    }
  },
};
