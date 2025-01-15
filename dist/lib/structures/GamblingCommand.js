import { Command } from '@sapphire/framework';
export class GamblingCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            preconditions: ['GamblingChannel']
        });
    }
    async messageRun(message, args) {
        // Implementation will be provided by extending commands
    }
}
