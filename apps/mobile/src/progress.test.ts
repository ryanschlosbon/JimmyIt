import { describe, expect, it } from 'vitest';
import { createMemoryKeyValueStore } from '@jimmyit/core';
import { createProgressService, getProgress, type DrawingSession } from './progress';

const session: DrawingSession = {
  id: 'drawing-test', activity: 'drawing', startedAtMs: 1_700_000_000_000, durationMs: 1200, strokes: 3,
};

describe('drawing rewards', () => {
  it('saves timed practice once and grows toy badges from the actual demo counts', async () => {
    const service = createProgressService(createMemoryKeyValueStore());
    const timed = { id: 'timed-test', startedAtMs: session.startedAtMs, durationMs: 30_000,
      actions: { press: 10, spin: 30, squeeze: 2 } };
    expect(await service.finishTimed(timed)).toBe(210);
    await service.finishTimed(timed);
    const records = await service.repository.list();
    const progress = getProgress(records);
    expect(records).toHaveLength(1);
    expect(progress.points).toBe(210);
    expect(progress.badges.find(badge => badge.id === 'buttons')?.count).toBe(10);
    expect(progress.badges.find(badge => badge.id === 'spinner')?.count).toBe(30);
  });

  it('saves exactly one score on duplicate submission or a retry', async () => {
    const service = createProgressService(createMemoryKeyValueStore());
    await Promise.all([service.finish(session), service.finish(session)]);
    const records = await service.repository.list();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: session.id, score: 50, actions: 3, stars: 3, completed: true });
    expect(getProgress(records).points).toBe(50);
  });

  it('persists points across service restarts and unlocks the shape badge', async () => {
    const store = createMemoryKeyValueStore();
    await createProgressService(store).finish({ ...session, activity: 'shapes' });
    const progress = getProgress(await createProgressService(store).repository.list());
    expect(progress.badges.find(badge => badge.id === 'first')?.count).toBe(1);
    expect(progress.badges.find(badge => badge.id === 'shapes')?.count).toBe(1);
    expect(progress.badges.find(badge => badge.id === 'drawing')?.count).toBe(0);
  });

  it('gives partial credit for trying, and advances a level at 250 points', async () => {
    const service = createProgressService(createMemoryKeyValueStore());
    for (let index = 0; index < 5; index += 1) await service.finish({ ...session, id: `session-${index}` });
    await service.finish({ ...session, id: 'empty', strokes: 0 });
    expect(getProgress(await service.repository.list())).toMatchObject({ points: 260, level: 2, levelPoints: 10 });
  });

  it('does not overwrite an unsupported saved score schema', async () => {
    const store = createMemoryKeyValueStore({ 'jimmyit.scores': '{"schemaVersion":99,"records":[]}' });
    await expect(createProgressService(store).finish(session)).rejects.toThrow('unsupported score schema');
    expect(await store.getItem('jimmyit.scores')).toBe('{"schemaVersion":99,"records":[]}');
  });

  it('counts consecutive local calendar days, not a collection of unrelated visits', async () => {
    const service = createProgressService(createMemoryKeyValueStore());
    for (const day of [1, 2, 4, 5, 6]) await service.finish({ ...session, id: `day-${day}`,
      startedAtMs: new Date(2026, 0, day, 12).getTime() });
    expect(getProgress(await service.repository.list()).badges.find(badge => badge.id === 'week')?.count).toBe(3);
  });
});
