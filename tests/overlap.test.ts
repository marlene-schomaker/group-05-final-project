import { describe, it, expect } from 'vitest';
import {
  findOverlapWindow,
  type AvailabilityBlock,
} from '../src/modules/events/overlap.js';

const block = (
  userId: number,
  start: string,
  end: string,
  date = '2099-03-14',
): AvailabilityBlock => ({
  userId,
  date,
  start,
  end,
});

const iso = (d: Date | undefined) => d?.toISOString();

describe('findOverlapWindow', () => {
  it('returns null with no blocks', () => {
    expect(findOverlapWindow([], 1, 30)).toBeNull();
  });

  it('finds the shared stretch when enough people overlap long enough', () => {
    const w = findOverlapWindow(
      [
        block(1, '10:00', '14:00'),
        block(2, '12:00', '16:00'),
        block(3, '12:00', '15:00'),
      ],
      3,
      120,
    );
    expect(iso(w?.start)).toBe('2099-03-14T12:00:00.000Z');
    expect(iso(w?.end)).toBe('2099-03-14T14:00:00.000Z');
  });

  it('returns null when the overlap is shorter than the minimum', () => {
    const w = findOverlapWindow(
      [block(1, '10:00', '11:00'), block(2, '10:30', '12:00')],
      2,
      60,
    );
    expect(w).toBeNull();
  });

  it('returns null when fewer people than the minimum are ever free together', () => {
    const w = findOverlapWindow(
      [block(1, '10:00', '12:00'), block(2, '13:00', '15:00')],
      2,
      30,
    );
    expect(w).toBeNull();
  });

  it('never counts the same person twice, even with overlapping blocks', () => {
    const w = findOverlapWindow(
      [block(1, '10:00', '12:00'), block(1, '11:00', '13:00')],
      2,
      30,
    );
    expect(w).toBeNull();
  });

  it('treats back to back blocks from one person as one continuous stretch', () => {
    const w = findOverlapWindow(
      [
        block(1, '10:00', '11:00'),
        block(1, '11:00', '12:00'),
        block(2, '10:00', '12:00'),
      ],
      2,
      120,
    );
    expect(iso(w?.start)).toBe('2099-03-14T10:00:00.000Z');
  });

  it('picks the earliest qualifying window across days', () => {
    const w = findOverlapWindow(
      [
        block(1, '10:00', '12:00', '2099-03-20'),
        block(2, '10:00', '12:00', '2099-03-20'),
        block(1, '09:00', '10:00', '2099-03-15'),
        block(2, '09:00', '10:00', '2099-03-15'),
      ],
      2,
      60,
    );
    expect(iso(w?.start)).toBe('2099-03-15T09:00:00.000Z');
    expect(iso(w?.end)).toBe('2099-03-15T10:00:00.000Z');
  });

  it('allows a larger crowd to qualify later than a smaller overlap', () => {
    const w = findOverlapWindow(
      [
        block(1, '09:00', '09:30'),
        block(2, '09:00', '09:30'),
        block(1, '13:00', '14:30'),
        block(2, '13:00', '14:30'),
        block(3, '13:00', '14:30'),
      ],
      3,
      60,
    );
    expect(iso(w?.start)).toBe('2099-03-14T13:00:00.000Z');
  });

  it('ignores invalid blocks', () => {
    const w = findOverlapWindow(
      [block(1, '12:00', '10:00'), block(2, '10:00', '12:00')],
      1,
      60,
    );
    expect(iso(w?.start)).toBe('2099-03-14T10:00:00.000Z');
  });
});
