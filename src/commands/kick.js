const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to kick').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the kick').setRequired(false).setMaxLength(512)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason     = interaction.options.getString('reason') ?? 'No reason provided';
    const botMember  = interaction.guild.members.me;

    if (targetUser.id === interaction.client.user.id) {
      return interaction.reply({ content: "I can't kick myself.", ephemeral: true });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: "You can't kick yourself.", ephemeral: true });
    }

    let member;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }

    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: `I can't kick **${targetUser.tag}** — their role is equal to or above mine.`, ephemeral: true });
    }
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: `You can't kick **${targetUser.tag}** — their role is equal to or above yours.`, ephemeral: true });
    }

    // DM the user before kicking
    try {
      await targetUser.send({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`You have been kicked from ${interaction.guild.name}`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp()],
      });
    } catch { /* DMs closed — ignore */ }

    await member.kick(reason);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Member Kicked')
        .setDescription(`**${targetUser.tag}** has been kicked.`)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: `Kicked by ${interaction.user.tag}` })
        .setTimestamp()],
      ephemeral: true,
    });
  },
};
