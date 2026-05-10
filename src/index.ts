import { App } from '@slack/bolt';
import type { BlockAction } from '@slack/bolt';
import { handleMessage, handleYes, handleNo } from './handler';
import { createCanvas } from './canvas';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

// ────────────────────────────────────────────
// メンション受信
// ────────────────────────────────────────────

app.event('app_mention', async ({ event, client, say }) => {
  const text = (event.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim();

  // Canvas初期化コマンド
  if (text === 'はじめるよ') {
    const canvasId = await createCanvas(client, event.channel);
    await say(`✅ Canvasを作成しました！\nCanvas ID: \`${canvasId}\`\n\`.env\` の \`CANVAS_ID\` に設定してBotを再起動してください。`);
    return;
  }

  await handleMessage({ message: { ...event, text, user: event.user! }, client, say });
});

// ────────────────────────────────────────────
// ボタン
// ────────────────────────────────────────────

app.action<BlockAction>('yes', async ({ body, ack, client, say }) => {
  await ack();
  await handleYes({ body, client, say });
});

app.action<BlockAction>('no', async ({ body, ack, say }) => {
  await ack();
  await handleNo({ body, say });
});

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log('Bot running');
})();