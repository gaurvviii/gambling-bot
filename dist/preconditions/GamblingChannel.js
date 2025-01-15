import { Precondition } from '@sapphire/framework';
import { GAMBLING_CHANNEL_ID } from '../lib/constants';
export class GamblingChannelPrecondition extends Precondition {
    async messageRun(message) {
        return message.channelId === GAMBLING_CHANNEL_ID
            ? this.ok()
            : this.error({ message: 'This command can only be used in the gambling channel!' });
    }
}
