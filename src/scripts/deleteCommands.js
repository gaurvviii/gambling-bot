import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { clientId, guildId, token } from '../config.json'; // Adjust the path as necessary

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started deleting application (/) commands.');

    // Replace 'COMMAND_ID_1' and 'COMMAND_ID_2' with the actual command IDs
    await rest.delete(Routes.applicationGuildCommand(clientId, guildId, 'COMMAND_ID_1'));
    await rest.delete(Routes.applicationGuildCommand(clientId, guildId, 'COMMAND_ID_2'));

    console.log('Successfully deleted application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})(); 