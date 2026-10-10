import type { AIProvider, GameGenerationRequest, GeneratedLevel } from './types';
import { createLocalProvider } from './local';
import { validateGeneratedLevel } from './validation';

export interface AIService {
  generateLevel(request: GameGenerationRequest): Promise<GeneratedLevel>;
  isAIProviderAvailable(): Promise<boolean>;
  testAIConnection(): Promise<boolean>;
}

/** Remote providers are injected only after an approved, trusted server connection exists. */
export function createAIService(options: { readonly remote?: AIProvider; readonly enabled?: boolean } = {}): AIService {
  const local = createLocalProvider();
  const remote = options.remote;
  const enabled = options.enabled === true && remote?.name === 'gemini';
  const recentPatterns = new Map<string, string[]>();
  const fingerprint = (level: GeneratedLevel): string => JSON.stringify({
    targets: level.targets.map(({ x, y }) => [Math.round(x * 20), Math.round(y * 20)]),
    sequence: level.sequence,
  });
  const isRecent = (level: GeneratedLevel): boolean =>
    recentPatterns.get(level.gameType)?.includes(fingerprint(level)) === true;
  const remember = (level: GeneratedLevel): GeneratedLevel => {
    const recent = recentPatterns.get(level.gameType) ?? [];
    recentPatterns.set(level.gameType, [...recent, fingerprint(level)].slice(-5));
    return level;
  };
  async function remoteStatus(check: 'isAvailable' | 'testConnection'): Promise<boolean> {
    if (!enabled) return false;
    try {
      return await remote[check]();
    } catch {
      return false;
    }
  }
  return {
    isAIProviderAvailable: () => remoteStatus('isAvailable'),
    testAIConnection: () => remoteStatus('testConnection'),
    generateLevel: async (request) => {
      if (enabled) {
        try {
          // Recent rounds stay on device even when a trusted provider is configured.
          const { performance: _performance, ...safeRequest } = request;
          if (await remote.isAvailable()) {
            const level = validateGeneratedLevel(await remote.generate(safeRequest), request);
            if (!isRecent(level)) return remember(level);
          }
        } catch {
          // All remote failures fall back locally; provider errors may contain secrets.
        }
      }
      let level: GeneratedLevel | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const variationSeed = attempt === 0 ? request.variationSeed
          : ((request.variationSeed ?? 0) + attempt) & 0x7fffffff;
        const candidateRequest = variationSeed === undefined ? request : { ...request, variationSeed };
        level = validateGeneratedLevel(await local.generate(candidateRequest), candidateRequest);
        if (!isRecent(level)) break;
      }
      if (!level) throw new Error('Could not generate a level');
      return remember(level);
    },
  };
}
