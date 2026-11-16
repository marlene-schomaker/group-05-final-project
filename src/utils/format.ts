export const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  blue: { bg: '#E7ECFF', fg: '#2F44B8' },
  green: { bg: '#DFF5EA', fg: '#1B6B45' },
  amber: { bg: '#FDEBD3', fg: '#8A4B08' },
  pink: { bg: '#FBE4EE', fg: '#9B2253' },
  violet: { bg: '#EBE4FB', fg: '#5B33B4' },
};

export const GROUP_COLORS = [
  'blue',
  'green',
  'amber',
  'pink',
  'violet',
] as const;

export function colorsFor(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.blue;
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} minutes`;
}

export function formatDurationShort(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${minutes} min`;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function eventPill(status: string): { pillBg: string; pillFg: string } {
  if (status === 'Confirmed') return { pillBg: '#DFF5EA', pillFg: '#1B6B45' };
  if (status === 'Needs your reply')
    return { pillBg: '#FDEBD3', pillFg: '#8A4B08' };
  if (status === 'Cancelled') return { pillBg: '#EAECF0', pillFg: '#344054' };
  return { pillBg: '#E7ECFF', pillFg: '#2F44B8' };
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatWeekday(
  d: Date,
  style: 'short' | 'long' = 'long',
): string {
  return d.toLocaleDateString('en-US', { weekday: style, timeZone: 'UTC' });
}

export function relativeTime(from: Date, now = Date.now()): string {
  const diffMins = Math.floor((now - from.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${pluralize(diffMins, 'minute')} ago`;
  if (diffHours < 24) return `${pluralize(diffHours, 'hour')} ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export function normalizeEmails(
  emails: string[],
  exclude: string[] = [],
): string[] {
  const skip = new Set(exclude.map((e) => e.toLowerCase().trim()));
  return [...new Set(emails.map((e) => e.toLowerCase().trim()))].filter(
    (e) => !skip.has(e),
  );
}
