import { describe, expect, it } from 'vitest';
import { createWebStorage } from './web-storage';

describe('web storage', () => {
  it('keeps all keys in the website namespace', async () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    } as Storage;
    const web = createWebStorage(storage);
    await web.setItem('scores', '42');
    expect(data.get('jimmyit.web.scores')).toBe('42');
    expect(data.has('scores')).toBe(false);
    expect(await web.getItem('scores')).toBe('42');
    await web.removeItem('scores');
    expect(await web.getItem('scores')).toBeNull();
  });
});
