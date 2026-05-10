export interface ActivityData {
  activities: Record<string, string>;
  // { '202605': { 10: '1', 12: '12', 15: '2' } }
  records: Record<string, Record<number, string>>;
}

export type PendingState = {
  type: 'confirm_new';
  activityName: string;
  channelId: string;
  canvasId: string;
};

export interface Period {
  months: string[];
  label: string;
}