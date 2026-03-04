const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 members by XP'),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'xp')) {
      return interaction.reply({ content: 'XP is disabled on this server.', ephemeral: true });
    }

    await interaction.deferReply();

    const rows = db.db
      .prepare('SELECT user_id, xp, level FROM xp WHERE guild_id = ? ORDER BY xp DESC LIMIT 10')
      .all(interaction.guild.id);

    if (!rows.length) {
      return interaction.editReply('No XP data yet — start chatting!');
    }

    const lines = await Promise.all(rows.map(async (row, i) => {
      const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
      const name = user ? user.username : `Unknown (${row.user_id})`;
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      return `${medal} **${name}** — Level ${row.level} (${row.xp.toLocaleString()} XP)`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`🏆 ${interaction.guild.name} XP Leaderboard`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
