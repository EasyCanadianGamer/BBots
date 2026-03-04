const { Events } = require('discord.js');
const logger = require('../logger.js');
const store = require('../store.js');
const db = require('../db.js');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {

    // ── Poll button votes ──────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('poll:')) {
      const [, messageId, indexStr] = interaction.customId.split(':');
      const idx   = parseInt(indexStr, 10);
      const polls = store.get('polls') ?? {};
      const poll  = polls[messageId];

      if (!poll) {
        return interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
      }

      // Single-choice: remove user from all options first
      let previousIdx = -1;
      poll.votes.forEach((voters, i) => {
        const pos = voters.indexOf(interaction.user.id);
        if (pos !== -1) { voters.splice(pos, 1); previousIdx = i; }
      });

      // Add vote unless the user clicked their current option (toggle off)
      if (previousIdx !== idx) {
        poll.votes[idx].push(interaction.user.id);
      }

      store.set('polls', polls);

      // Update the poll message
      const { buildPollEmbed, buildPollComponents } = require('../commands/poll.js');
      const channel = interaction.client.channels.cache.get(poll.channelId);
      const msg = await channel?.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [buildPollEmbed(poll.question, poll.options, poll.votes)],
          components: buildPollComponents(messageId, poll.options),
        });
      }

      const voted = previousIdx !== idx;
      return interaction.reply({
        content: voted ? `✅ Voted for **${poll.options[idx]}**!` : '🗑️ Vote removed.',
        ephemeral: true,
      });
    }

    // ── Role menu button ────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('rolemenu:')) {
      const [,, roleId] = interaction.customId.split(':');
      if (!db.isEnabled(interaction.guild.id, 'role_menus')) {
        return interaction.reply({ content: 'Role menus are disabled on this server.', ephemeral: true });
      }
      const member = interaction.member;
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        const role = interaction.guild.roles.cache.get(roleId);
        return interaction.reply({ content: `🗑️ Role removed: **${role?.name ?? roleId}**`, ephemeral: true });
      } else {
        await member.roles.add(roleId);
        const role = interaction.guild.roles.cache.get(roleId);
        return interaction.reply({ content: `✅ Role added: **${role?.name ?? roleId}**`, ephemeral: true });
      }
    }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
      logger.add('command', `/${interaction.commandName} used by ${interaction.user.tag} in ${interaction.guild?.name ?? 'DM'}`);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const errorMsg = { content: 'There was an error executing this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  },
};
