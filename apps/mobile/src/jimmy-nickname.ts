/** A display name belongs to this app's user, without changing the toy's Bluetooth identity. */
const NICKNAME_KEY = 'jimmy.nickname';
export const JIMMY_NICKNAME_MAX_LENGTH = 32;

interface NicknameStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface JimmyNicknamePreference {
  load(): Promise<string | null>;
  save(draft: string): Promise<string>;
  reset(): Promise<void>;
}

export class JimmyNicknameError extends Error {
  constructor(message: string) { super(message); this.name = 'JimmyNicknameError'; }
}

function normalizeNickname(draft: string): string {
  const name = draft.trim().replace(/\s+/gu, ' ');
  if (!name) throw new JimmyNicknameError('Give your Jimmy a name first.');
  if (Array.from(name).length > JIMMY_NICKNAME_MAX_LENGTH) {
    throw new JimmyNicknameError(`Choose a name with ${JIMMY_NICKNAME_MAX_LENGTH} characters or fewer.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(name)) {
    throw new JimmyNicknameError('Use letters, numbers, or emoji for your Jimmy’s name.');
  }
  return name;
}

/** Stores only the user's local display preference; callers update UI after a successful write. */
export function createJimmyNicknamePreference(storage: NicknameStorage): JimmyNicknamePreference {
  return {
    async load() {
      const saved = await storage.getItem(NICKNAME_KEY);
      if (saved === null) return null;
      try { return normalizeNickname(saved); } catch { return null; }
    },
    async save(draft) {
      const name = normalizeNickname(draft);
      await storage.setItem(NICKNAME_KEY, name);
      return name;
    },
    async reset() { await storage.removeItem(NICKNAME_KEY); },
  };
}
