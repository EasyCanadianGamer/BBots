const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

function xpToLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)); }
function levelToXp(level) { return Math.pow(level / 0.1, 2); }

function progressBar(current, target, length = 10) {
  const filled = Math.round((current / target) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Check XP and level')
    .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)')),

  async execute(interaction) {
    if (!db.isEnabled(interaction.guild.id, 'xp')) {
      return interaction.reply({ content: 'XP is disabled on this server.', ephemeral: true });
    }

    const target = interaction.options.getUser('user') ?? interaction.user;
    const row = db.db
      .prepare('SELECT xp, level FROM xp WHERE guild_id = ? AND user_id = ?')
      .get(interaction.guild.id, target.id);

    const profile = db.db
      .prepare('SELECT banner_url FROM user_profiles WHERE user_id = ?')
      .get(target.id);

    const totalXp = row?.xp ?? 0;
    const level   = row?.level ?? 0;
    const nextLvl = level + 1;
    const currentLvlXp = Math.floor(levelToXp(level));
    const nextLvlXp    = Math.floor(levelToXp(nextLvl));
    const progress = totalXp - currentLvlXp;
    const needed   = nextLvlXp - currentLvlXp;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${target.username}'s XP`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Level', value: `${level}`, inline: true },
        { name: 'Total XP', value: `${totalXp.toLocaleString()}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: `Progress to Level ${nextLvl}`, value: `${progressBar(progress, needed)} ${progress} / ${needed} XP` }
      )
      .setTimestamp();

    if (profile?.banner_url) embed.setImage(profile.banner_url);

    return interaction.reply({ embeds: [embed] });
  },
};
