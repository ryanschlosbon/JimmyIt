import type { GameGenerationRequest, GeneratedLevel } from './types';
import { createLocalProvider } from './local';
import { validateGeneratedLevel } from './validation';

export interface AIService {
  generateLevel(request: GameGenerationRequest): Promise<GeneratedLevel>;
}

/** On-device level generation that avoids repeating one of the last five layouts per game type. */
export function createAIService(): AIService {
  const local = createLocalProvider();
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
  return {
    generateLevel: async (request) => {
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
