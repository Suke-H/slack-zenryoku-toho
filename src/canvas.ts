import type { WebClient } from '@slack/web-api';
import type { ActivityData } from './types';

const MARKER = '<!-- DATA -->';

export async function getOrCreateCanvas(client: WebClient, channelId: string): Promise<string> {
  try {
    const res = await client.canvases.create({
      channel_id: channelId,
      document_content: {
        type: 'markdown',
        markdown: `# 活動記録\n${MARKER}\n`,
      },
    });
    return res.canvas_id as string;
  } catch (e: any) {
    if (e.data?.error === 'canvas_already_exists') {
      const info = await client.conversations.info({ channel: channelId });
      return (info.channel as any).properties?.canvas?.file_id as string;
    }
    throw e;
  }
}

export async function readCanvas(client: WebClient, canvasId: string): Promise<string> {
  const res = await client.canvases.sections.lookup({
    canvas_id: canvasId,
    criteria: { contains_text: MARKER },
  });
  const sections = (res.sections as any[]) ?? [];
  return sections.map((s) => s.markdown ?? '').join('\n');
}

export async function writeCanvas(
  client: WebClient,
  canvasId: string,
  data: ActivityData
): Promise<void> {
  const markdown = `# 活動記録\n${MARKER}\n${serialize(data)}`;
  await client.canvases.edit({
    canvas_id: canvasId,
    changes: [
      {
        operation: 'replace',
        document_content: { type: 'markdown', markdown },
      },
    ],
  });
}

export function parse(text: string): ActivityData {
  const activities: Record<string, string> = {};
  const records: Record<string, string[]> = {};
  let currentMonth: string | null = null;

  for (const line of text.split('\n')) {
    const actMatch = line.match(/^(\d+):\s*(.+)/);
    if (actMatch) {
      activities[actMatch[1]] = actMatch[2].trim();
      continue;
    }
    const monthMatch = line.match(/^(\d{6})$/);
    if (monthMatch) {
      currentMonth = monthMatch[1];
      records[currentMonth] = Array(daysInMonth(currentMonth)).fill('-');
      continue;
    }
    if (currentMonth && line.startsWith('-')) {
      records[currentMonth] = line.split(' ');
    }
  }

  return { activities, records };
}

export function serialize({ activities, records }: ActivityData): string {
  const lines: string[] = [];
  for (const [num, name] of Object.entries(activities)) {
    lines.push(`${num}: ${name}`);
  }
  for (const [month, cells] of Object.entries(records)) {
    lines.push('', month, cells.join(' '));
  }
  return lines.join('\n');
}

export function ensureMonth(data: ActivityData, yyyymm: string): void {
  if (!data.records[yyyymm]) {
    data.records[yyyymm] = Array(daysInMonth(yyyymm)).fill('-');
  }
}

export function findNum(data: ActivityData, name: string): string | null {
  return Object.entries(data.activities).find(([, v]) => v === name)?.[0] ?? null;
}

export function nextNum(data: ActivityData): string {
  const nums = Object.keys(data.activities).map(Number);
  return nums.length === 0 ? '1' : String(Math.max(...nums) + 1);
}

export function countActivity(cells: string[], num: string): number {
  return cells.filter((c) => c !== '-' && c.includes(num)).length;
}

export function toYYYYMM(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(yyyymm: string): number {
  const y = parseInt(yyyymm.slice(0, 4));
  const m = parseInt(yyyymm.slice(4, 6));
  return new Date(y, m, 0).getDate();
}
