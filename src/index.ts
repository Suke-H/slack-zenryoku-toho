import { App } from '@slack/bolt';
import { handleMessage } from './handler';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

app.event('app_mention', async ({ event, client, say }) => {
  const text = (event.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim();
  await handleMessage({ message: { ...event, text }, client, say });
});

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log('Bot running');
})();
