export interface AvailabilityBlock {
  userId: number;
  date: string;
  start: string;
  end: string;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export function normalizeTime(time: string): string {
  const parts = String(time).slice(0, 8).split(':');
  const [h = '00', m = '00', s = '00'] = parts;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

export function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// Stored times have no zone and are interpreted as UTC
export function toEpoch(date: string, time: string): number {
  return Date.parse(`${date}T${normalizeTime(time)}Z`);
}

interface Interval {
  start: number;
  end: number;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function findOverlapWindow(
  blocks: AvailabilityBlock[],
  minAttendees: number,
  minDurationMinutes: number,
): TimeWindow | null {
  const byUser = new Map<number, Interval[]>();
  for (const block of blocks) {
    const start = toEpoch(block.date, block.start);
    const end = toEpoch(block.date, block.end);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const list = byUser.get(block.userId) ?? [];
    list.push({ start, end });
    byUser.set(block.userId, list);
  }

  const deltas = new Map<number, number>();
  for (const intervals of byUser.values()) {
    for (const { start, end } of mergeIntervals(intervals)) {
      deltas.set(start, (deltas.get(start) ?? 0) + 1);
      deltas.set(end, (deltas.get(end) ?? 0) - 1);
    }
  }

  const times = [...deltas.keys()].sort((a, b) => a - b);
  const minMs = minDurationMinutes * 60_000;

  let active = 0;
  let runStart: number | null = null;

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    active += deltas.get(t) ?? 0;
    const qualifies = active >= minAttendees;

    if (qualifies && runStart === null) runStart = t;

    if (!qualifies && runStart !== null) {
      if (t - runStart >= minMs) {
        return { start: new Date(runStart), end: new Date(runStart + minMs) };
      }
      runStart = null;
    }
  }

  return null;
}
