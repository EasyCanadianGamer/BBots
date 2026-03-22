const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const BUILTIN_COMMANDS = [
  { name: '/announce',      desc: 'Post an announcement embed to a channel' },
  { name: '/ban',           desc: 'Ban a member from the server' },
  { name: '/kick',          desc: 'Kick a member from the server' },
  { name: '/mute',          desc: 'Timeout a member' },
  { name: '/warn',          desc: 'Issue a warning to a member' },
  { name: '/poll',          desc: 'Create a reaction poll' },
  { name: '/role',          desc: 'Add or remove a role from a member' },
  { name: '/welcome',       desc: 'Manually send a welcome message' },
  { name: '/help',          desc: 'Show this help message' },
];

const SERVER_COMMANDS = [
  { name: '/xp',            desc: 'View your XP and level' },
  { name: '/leaderboard',   desc: 'Show the top 10 XP leaderboard' },
  { name: '/birthday',      desc: 'Set, remove, or list birthdays' },
  { name: '/rolemenu',      desc: 'Create self-assignable role menus' },
  { name: '/notifications', desc: 'Manage Twitch / YouTube / RSS feeds' },
  { name: '/banner',        desc: 'Set a custom profile banner for your /xp card' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('BBots Commands')
      .addFields(
        {
          name: '🔧 Built-in Commands',
          value: BUILTIN_COMMANDS.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'),
        },
        {
          name: '⚙️ Server Commands',
          value: SERVER_COMMANDS.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'),
        },
      );

    if (guildId && db.isEnabled(guildId, 'custom_commands')) {
      const prefix = db.guildGet(guildId, 'prefix') ?? '!';
      const cmds = db.db
        .prepare('SELECT name FROM custom_commands WHERE guild_id = ? ORDER BY name')
        .all(guildId);
      if (cmds.length) {
        embed.addFields({
          name: `🔤 Custom Commands (prefix: \`${prefix}\`)`,
          value: cmds.map(c => `\`${prefix}${c.name}\``).join('  '),
        });
      }
    }

    embed.setFooter({ text: 'Server commands can be toggled in the dashboard under Features' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
