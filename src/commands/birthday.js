const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set your birthday')
      .addIntegerOption(opt => opt.setName('month').setDescription('Month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
      .addIntegerOption(opt => opt.setName('day').setDescription('Day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))

    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove your birthday')
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List upcoming birthdays in this server')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === 'set') {
      const month = interaction.options.getInteger('month');
      const day   = interaction.options.getInteger('day');
      db.db.prepare(
        'INSERT OR REPLACE INTO birthdays (guild_id, user_id, month, day) VALUES (?, ?, ?, ?)'
      ).run(guildId, userId, month, day);
      return interaction.reply({
        content: `🎂 Birthday set to **${MONTHS[month - 1]} ${day}**!`,
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      db.db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
      return interaction.reply({ content: '🗑️ Birthday removed.', ephemeral: true });
    }

    if (sub === 'list') {
      const rows = db.db
        .prepare('SELECT user_id, month, day FROM birthdays WHERE guild_id = ? ORDER BY month, day')
        .all(guildId);

      if (!rows.length) {
        return interaction.reply({ content: 'No birthdays registered in this server.', ephemeral: true });
      }

      const lines = rows.map(r => `<@${r.user_id}> — ${MONTHS[r.month - 1]} ${r.day}`);
      const embed = new EmbedBuilder()
        .setColor(0xFF73FA)
        .setTitle('🎂 Server Birthdays')
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
