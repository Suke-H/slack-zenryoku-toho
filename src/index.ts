import { App } from '@slack/bolt';
import { handleMessage, handleYes, handleNo } from './handler';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

app.use(async ({ payload, next }) => {
  console.log('受信:', JSON.stringify(payload, null, 2));
  await next();
});

app.event('app_mention', async ({ event, client, say }) => {
  console.log('app_mention 受信');
  const text = (event.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim();
  await handleMessage({ message: { ...event, text }, client, say });
});

app.action('yes', async ({ body, client, ack, say }) => {
  console.log('action:yes 受信');
  await ack();
  await handleYes({ body, client, say });
});

app.action('no', async ({ body, ack, say }) => {
  console.log('action:no 受信');
  await ack();
  await handleNo({ body, say });
});

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log('Bot running');
})();
