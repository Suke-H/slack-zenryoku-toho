export interface ActivityData {
  // { '1': '筋トレ', '2': '掃除' }
  activities: Record<string, string>;
  // { '202605': ['-', '1', '12', '-', ...] }  31要素
  records: Record<string, string[]>;
}

export type PendingState =
  | { type: 'confirm_new'; activityName: string; channelId: string; canvasId: string }

export interface Period {
  months: string[];
  label: string;
}
