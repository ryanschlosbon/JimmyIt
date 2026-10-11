import { describe, expect, it, vi } from 'vitest';
import { createJimmyNicknamePreference, JimmyNicknameError } from './jimmy-nickname';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

describe('Jimmy nickname preference', () => {
  it('defaults to no nickname and persists a normalized name across instances', async () => {
    const storage = memoryStorage();
    const preference = createJimmyNicknamePreference(storage);
    expect(await preference.load()).toBeNull();
    expect(await preference.save('  Sunny   Jimmy 🌞  ')).toBe('Sunny Jimmy 🌞');
    expect(await createJimmyNicknamePreference(storage).load()).toBe('Sunny Jimmy 🌞');
  });

  it('rejects empty, long, and control-character names without replacing the saved name', async () => {
    const preference = createJimmyNicknamePreference(memoryStorage());
    await preference.save('Sunny');
    for (const draft of [' \n ', 'a'.repeat(33), 'Sun\u0000ny']) {
      await expect(preference.save(draft)).rejects.toBeInstanceOf(JimmyNicknameError);
      expect(await preference.load()).toBe('Sunny');
    }
    expect(await preference.save('🌞'.repeat(32))).toBe('🌞'.repeat(32));
  });

  it('ignores an invalid stored preference and resets to the toy default', async () => {
    const storage = memoryStorage();
    await storage.setItem('jimmy.nickname', 'a'.repeat(100));
    const preference = createJimmyNicknamePreference(storage);
    expect(await preference.load()).toBeNull();
    await preference.save('Sunny');
    await preference.reset();
    expect(await preference.load()).toBeNull();
  });

  it('reports storage failures so the UI cannot claim an unsaved name is saved', async () => {
    const storage = memoryStorage();
    const preference = createJimmyNicknamePreference(storage);
    await preference.save('Sunny');
    vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('Storage unavailable'));
    await expect(preference.save('Buddy')).rejects.toThrow('Storage unavailable');
    expect(await preference.load()).toBe('Sunny');
    vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('Read unavailable'));
    await expect(preference.load()).rejects.toThrow('Read unavailable');
    vi.spyOn(storage, 'removeItem').mockRejectedValue(new Error('Reset unavailable'));
    await expect(preference.reset()).rejects.toThrow('Reset unavailable');
  });
});
