import { test, expect } from 'vitest';
import {
  uid, todayStr, formatDate, paceToSeconds, secondsToPace,
  daysBetween, getWeekStart, scoreColor, cx,
} from '../utils.js';

test('uid produces unique strings', () => {
  const a = uid();
  const b = uid();
  expect(a).not.toBe(b);
  expect(a.length).toBeGreaterThan(0);
});

test('todayStr returns YYYY-MM-DD', () => {
  expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('formatDate localizes IT', () => {
  const out = formatDate('2026-01-15');
  expect(out).toMatch(/2026/);
});

test('paceToSeconds parses mm:ss', () => {
  expect(paceToSeconds('5:30')).toBe(330);
  expect(paceToSeconds('4:00')).toBe(240);
});

test('paceToSeconds parses minutes per km decimal', () => {
  expect(paceToSeconds(5.5)).toBe(330);
});

test('paceToSeconds returns 0 for null/empty', () => {
  expect(paceToSeconds(null)).toBe(0);
  expect(paceToSeconds('')).toBe(0);
});

test('secondsToPace formats mm:ss', () => {
  expect(secondsToPace(330)).toBe('5:30');
  expect(secondsToPace(60)).toBe('1:00');
  expect(secondsToPace(0)).toBe('--');
});

test('secondsToPace handles 60-second boundary', () => {
  // 359.5 rounds to 360s which would naively format as 5:60 — should normalize to 6:00.
  expect(secondsToPace(359.6)).toBe('6:00');
});

test('daysBetween returns absolute days', () => {
  expect(daysBetween('2026-05-01', '2026-05-11')).toBe(10);
  expect(daysBetween('2026-05-11', '2026-05-01')).toBe(10);
});

test('getWeekStart returns Monday', () => {
  // 2026-05-11 is a Monday; week start should be 2026-05-11.
  expect(getWeekStart('2026-05-11')).toBe('2026-05-11');
  // Wednesday 2026-05-13 -> Monday 2026-05-11.
  expect(getWeekStart('2026-05-13')).toBe('2026-05-11');
});

test('scoreColor returns expected CSS vars', () => {
  expect(scoreColor(10)).toBe('var(--fuchsia-bright)');
  expect(scoreColor(9.5)).toBe('var(--fuchsia)');
  expect(scoreColor(8.2)).toBe('var(--green)');
  expect(scoreColor(7.1)).toBe('var(--light-green)');
  expect(scoreColor(6.5)).toBe('var(--yellow)');
  expect(scoreColor(5)).toBe('var(--orange)');
  expect(scoreColor(2)).toBe('var(--red)');
});

test('cx joins truthy class names', () => {
  expect(cx('a', 'b')).toBe('a b');
  expect(cx('a', false, null, 'b')).toBe('a b');
  expect(cx()).toBe('');
});
