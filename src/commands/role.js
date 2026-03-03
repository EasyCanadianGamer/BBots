const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Assign or remove a role from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role to a user')
        .addUserOption(option =>
          option.setName('user').setDescription('The target user').setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role').setDescription('The role to assign').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption(option =>
          option.setName('user').setDescription('The target user').setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role').setDescription('The role to remove').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const member = await interaction.guild.members.fetch(targetUser.id);
    const botMember = interaction.guild.members.me;

    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `I cannot manage the **${role.name}** role because it is equal to or higher than my highest role.`,
        ephemeral: true,
      });
    }

    if (subcommand === 'add') {
      if (member.roles.cache.has(role.id)) {
        return interaction.reply({
          content: `${targetUser.tag} already has the **${role.name}** role.`,
          ephemeral: true,
        });
      }
      await member.roles.add(role);
      await interaction.reply({
        content: `Successfully added **${role.name}** to ${targetUser.tag}.`,
        ephemeral: true,
      });

    } else if (subcommand === 'remove') {
      if (!member.roles.cache.has(role.id)) {
        return interaction.reply({
          content: `${targetUser.tag} does not have the **${role.name}** role.`,
          ephemeral: true,
        });
      }
      await member.roles.remove(role);
      await interaction.reply({
        content: `Successfully removed **${role.name}** from ${targetUser.tag}.`,
        ephemeral: true,
      });
    }
  },
};
