import { config } from 'dotenv';

config();

if (!process.env.GAMBLING_CHANNEL_ID) {
  throw new Error('GAMBLING_CHANNEL_ID is not defined in .env file');
}

export const GAMBLING_CHANNEL_ID = process.env.GAMBLING_CHANNEL_ID;