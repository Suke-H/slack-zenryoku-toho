import type { SayFn } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import type { ActivityData, PendingState, Period } from './types';
import {
  getOrCreateCanvas,
  readCanvas,
  writeCanvas,
  parse,
  ensureMonth,
  findNum,
  nextNum,
  countActivity,
  toYYYYMM,
} from './canvas';

const pending = new Map<string, PendingState>();

interface Context {
  message: { text?: string; user: string; channel: string; ts: string };
  client: WebClient;
  say: SayFn;
}

export async function handleMessage({ message, client, say }: Context): Promise<void> {
  const text = message.text?.trim();
  const userId = message.user;
  const channelId = message.channel;
  if (!text) return;

  if (pending.has(userId)) {
    await handlePending({ userId, text, client, say });
    return;
  }

  if (isViewRequest(text)) {
    await handleView({ text, channelId, client, say });
    return;
  }

  const activityName = extractActivity(text);
  if (activityName) {
    await handleRecord({ activityName, channelId, userId, client, say });
    return;
  }

  await say('「筋トレしたよ」のように記録するか、「今月見せて」で確認できます。');
}

async function handleRecord({
  activityName,
  channelId,
  userId,
  client,
  say,
}: {
  activityName: string;
  channelId: string;
  userId: string;
  client: WebClient;
  say: SayFn;
}): Promise<void> {
  const canvasId = await getOrCreateCanvas(client, channelId);
  const data = parse(await readCanvas(client, canvasId));
  const num = findNum(data, activityName);

  if (!num) {
    pending.set(userId, { type: 'confirm_new', activityName, channelId, canvasId });
    await say({
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*"${activityName}"* は新しい活動です。登録しますか？` },
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'はい' }, action_id: 'yes', value: 'yes' },
            { type: 'button', text: { type: 'plain_text', text: 'いいえ' }, action_id: 'no', value: 'no' },
          ],
        },
      ],
    });
    return;
  }

  await saveRecord({ data, num, canvasId, activityName, client, say });
}

async function saveRecord({
  data,
  num,
  canvasId,
  activityName,
  client,
  say,
}: {
  data: ActivityData;
  num: string;
  canvasId: string;
  activityName: string;
  client: WebClient;
  say: SayFn;
}): Promise<void> {
  const today = new Date();
  const yyyymm = toYYYYMM(today);
  const dayIndex = today.getDate() - 1;

  ensureMonth(data, yyyymm);

  const cell = data.records[yyyymm][dayIndex];
  data.records[yyyymm][dayIndex] = cell === '-' ? num : cell + num;

  await writeCanvas(client, canvasId, data);

  const count = countActivity(data.records[yyyymm], num);
  await say(`✅ *${activityName}* を記録しました！（今月${count}回目）`);
}

async function handlePending({
  userId,
  text,
  client,
  say,
}: {
  userId: string;
  text: string;
  client: WebClient;
  say: SayFn;
}): Promise<void> {
  const state = pending.get(userId)!;
  pending.delete(userId);

  if (!/^(はい|yes|y|うん|ok)$/i.test(text)) {
    await say('キャンセルしました。');
    return;
  }

  const data = parse(await readCanvas(client, state.canvasId));
  const num = nextNum(data);
  data.activities[num] = state.activityName;

  await saveRecord({ data, num, canvasId: state.canvasId, activityName: state.activityName, client, say });
}

async function handleView({
  text,
  channelId,
  client,
  say,
}: {
  text: string;
  channelId: string;
  client: WebClient;
  say: SayFn;
}): Promise<void> {
  const canvasId = await getOrCreateCanvas(client, channelId);
  const data = parse(await readCanvas(client, canvasId));
  const { months, label } = resolvePeriod(text);
  const targetNum = resolveTargetActivity(text, data);

  const lines: string[] = [`📊 *${label}の記録*`];
  let hasAny = false;

  for (const yyyymm of months) {
    const cells = data.records[yyyymm];
    if (!cells) continue;

    const targets = targetNum
      ? [[targetNum, data.activities[targetNum]]]
      : Object.entries(data.activities);

    for (const [num, name] of targets) {
      const days = cells
        .map((c, i) => ({ c, d: i + 1 }))
        .filter(({ c }) => c !== '-' && c.includes(num))
        .map(({ d }) => `${d}日`);

      if (days.length > 0) {
        lines.push(`・*${name}*：${days.length}回（${days.join(', ')}）`);
        hasAny = true;
      }
    }
  }

  if (!hasAny) lines.push('記録がありません。');
  await say(lines.join('\n'));
}

function isViewRequest(text: string): boolean {
  return /見せて|見せろ|確認|一覧|何回|何度/.test(text);
}

function extractActivity(text: string): string | null {
  const m = text.match(/^(.+?)(?:したよ|やったよ|した|やった|やりました|しました)$/);
  return m ? m[1].trim() : null;
}

function resolveTargetActivity(text: string, data: ActivityData): string | null {
  return Object.entries(data.activities).find(([, name]) => text.includes(name))?.[0] ?? null;
}

function resolvePeriod(text: string): Period {
  const now = new Date();

  if (/先月/.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { months: [toYYYYMM(d)], label: `${d.getMonth() + 1}月` };
  }

  const mMatch = text.match(/(\d{1,2})月/);
  if (mMatch) {
    const month = parseInt(mMatch[1]);
    const d = new Date(now.getFullYear(), month - 1, 1);
    return { months: [toYYYYMM(d)], label: `${month}月` };
  }

  if (/先週/.test(text)) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - 13 + i);
      return toYYYYMM(d);
    });
    return { months: [...new Set(days)], label: '先週' };
  }

  return { months: [toYYYYMM(now)], label: `${now.getMonth() + 1}月` };
}
