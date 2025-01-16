import { Command } from '@sapphire/framework';

export class RoleIdsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'roleids',
      description: 'List all role IDs in the server'
    });
  }

  async chatInputRun(interaction) {
    const roles = interaction.guild.roles.cache;
    let response = 'Roles and their IDs:\n';

    roles.forEach(role => {
      response += `${role.name}: ${role.id}\n`;
    });

    return interaction.reply(response);
  }
} 