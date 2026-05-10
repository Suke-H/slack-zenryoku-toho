import type { WebClient } from '@slack/web-api';
import type { ActivityData } from './types';

// ────────────────────────────────────────────
// Canvas取得
// ────────────────────────────────────────────

export async function getOrCreateCanvas(client: WebClient, channelId: string): Promise<string> {
  const canvasId = process.env.CANVAS_ID;
  if (canvasId) return canvasId;
  throw new Error('CANVAS_IDが設定されていません。@bot はじめるよ を実行してください。');
}

export async function createCanvas(client: WebClient, channelId: string): Promise<string> {
  const res = await client.canvases.create({
    title: '活動記録',
    channel_id: channelId,
    document_content: {
      type: 'markdown',
      markdown: '',
    },
  });
  return res.canvas_id as string;
}

// ────────────────────────────────────────────
// Canvas読み書き
// ────────────────────────────────────────────

export async function readCanvas(client: WebClient, canvasId: string): Promise<string> {
  const res = await client.canvases.sections.lookup({
    canvas_id: canvasId,
    criteria: { contains_text: ':' },
  });
  const sections = (res.sections as any[]) ?? [];
  return sections.map((s) => s.markdown ?? '').join('\n');
}

export async function writeCanvas(
  client: WebClient,
  canvasId: string,
  data: ActivityData
): Promise<void> {
  await client.canvases.edit({
    canvas_id: canvasId,
    changes: [
      {
        operation: 'replace',
        document_content: { type: 'markdown', markdown: serialize(data) },
      },
    ],
  });
}

// ────────────────────────────────────────────
// パース / シリアライズ
//
// フォーマット:
//   1: 筋トレ
//   2: 掃除
//
//   202605
//   10:1 12:12 15:2
// ────────────────────────────────────────────

export function parse(text: string): ActivityData {
  const activities: Record<string, string> = {};
  const records: Record<string, Record<number, string>> = {};
  let currentMonth: string | null = null;

  for (const line of text.split('\n')) {
    // アクティビティマスタ
    const actMatch = line.match(/^(\d+):\s*(.+)/);
    if (actMatch) {
      activities[actMatch[1]] = actMatch[2].trim();
      continue;
    }

    // 年月ブロック
    const monthMatch = line.match(/^(\d{6})$/);
    if (monthMatch) {
      currentMonth = monthMatch[1];
      records[currentMonth] = {};
      continue;
    }

    // 記録行: 10:1 12:12 15:2
    if (currentMonth && line.trim() && !line.startsWith('#') && !line.startsWith('<')) {
      for (const token of line.trim().split(' ')) {
        const m = token.match(/^(\d+):(\w+)$/);
        if (m) {
          records[currentMonth][parseInt(m[1])] = m[2];
        }
      }
    }
  }

  return { activities, records };
}

export function serialize({ activities, records }: ActivityData): string {
  const lines: string[] = [];

  for (const [num, name] of Object.entries(activities)) {
    lines.push(`${num}: ${name}`);
  }

  for (const [month, days] of Object.entries(records)) {
    lines.push('', month);
    const tokens = Object.entries(days)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, nums]) => `${day}:${nums}`);
    if (tokens.length > 0) lines.push('', tokens.join(' '));
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────

export function ensureMonth(data: ActivityData, yyyymm: string): void {
  if (!data.records[yyyymm]) {
    data.records[yyyymm] = {};
  }
}

export function findNum(data: ActivityData, name: string): string | null {
  return Object.entries(data.activities).find(([, v]) => v === name)?.[0] ?? null;
}

export function nextNum(data: ActivityData): string {
  const nums = Object.keys(data.activities).map(Number);
  return nums.length === 0 ? '1' : String(Math.max(...nums) + 1);
}

export function countActivity(days: Record<number, string>, num: string): number {
  return Object.values(days).filter((v) => v.includes(num)).length;
}

export function toYYYYMM(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}