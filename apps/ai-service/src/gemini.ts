import { GoogleGenAI } from '@google/genai';
import { validateGeneratedLevel, type AIProvider, type GameGenerationRequest } from '@jimmyit/ai';

/** The documented structured-output models this proxy permits. */
export const SUPPORTED_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;
export const DEFAULT_MODEL = 'gemini-3.8-flash';

interface GeminiClient {
  readonly models: {
    get(options: { model: string; config?: { abortSignal: AbortSignal } }):
      Promise<{ readonly supportedActions?: string[] }>;
    generateContent(options: {
      model: string;
      contents: string;
      config: {
        responseMimeType: string;
        responseJsonSchema: unknown;
        maxOutputTokens: number;
        abortSignal: AbortSignal;
        systemInstruction: string;
      };
    }): Promise<{ readonly text?: string }>;
  };
}

const STRING = { type: 'string' } as const;
const BOOLEAN = { type: 'boolean' } as const;
const NUMBER = { type: 'number' } as const;
const NULLABLE_DURATION = { anyOf: [{ type: 'integer', minimum: 500, maximum: 180000 }, { type: 'null' }] };

/** JSON Schema is a generation hint; the local validator is authoritative. */
export const LEVEL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: STRING, title: STRING, instructions: STRING,
    gameType: { type: 'string', enum: ['tapQuest', 'shapeQuest', 'memoryQuest', 'reaction', 'calm'] },
    difficulty: { type: 'integer', minimum: 1, maximum: 5 },
    targets: { type: 'array', maxItems: 12, items: { type: 'object',
      properties: { x: NUMBER, y: NUMBER, radius: NUMBER, order: { type: 'integer' },
        shape: { type: 'string', enum: ['circle', 'square', 'rectangle', 'triangle'] } },
      required: ['x', 'y', 'radius', 'order'] } },
    sequence: { type: 'array', maxItems: 12, items: { type: 'string',
      enum: ['screenTouch', 'clicker', 'navLeft', 'navRight', 'spinner'] } },
    theme: STRING,
    timing: { type: 'object', properties: { responseWindowMs: NULLABLE_DURATION,
      activityDurationMs: NULLABLE_DURATION }, required: ['responseWindowMs', 'activityDurationMs'] },
    sensory: { type: 'object', properties: { motion: BOOLEAN, sound: BOOLEAN, distractions: BOOLEAN },
      required: ['motion', 'sound', 'distractions'] },
    source: { type: 'string', enum: ['gemini'] },
  },
  required: ['id', 'title', 'instructions', 'gameType', 'difficulty', 'targets', 'sequence',
    'theme', 'timing', 'sensory', 'source'],
} as const;

export interface GeminiProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  /** Test seam; production uses the official SDK. */
  readonly client?: GeminiClient;
}

export function createGeminiProvider(options: GeminiProviderOptions): AIProvider {
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const client: GeminiClient | null = options.client ??
    (options.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : null);
  async function available(): Promise<boolean> {
    if (!client || !SUPPORTED_MODELS.includes(model as typeof SUPPORTED_MODELS[number])) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const info = await client.models.get({ model, config: { abortSignal: controller.signal } });
      return info.supportedActions?.includes('generateContent') === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    name: 'gemini', isAvailable: available, testConnection: available,
    generate: async (request: GameGenerationRequest) => {
      if (!client || !await available()) throw new Error('Gemini model unavailable');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { performance: _performance, ...safeRequest } = request;
        const response = await client.models.generateContent({
          model,
          contents: JSON.stringify(safeRequest),
          config: { responseMimeType: 'application/json', responseJsonSchema: LEVEL_SCHEMA,
            maxOutputTokens: 1200, abortSignal: controller.signal,
            systemInstruction: 'Create one short, positive child-friendly activity. Follow the JSON schema. ' +
              'Use only supplied controls. Never infer health or emotions. Respect all accessibility limits. ' +
              'Use variationSeed to create a distinct target layout and order on each new request.',
          },
        });
        if (!response.text || response.text.length > 16_000) throw new Error('Invalid Gemini response');
        return validateGeneratedLevel(JSON.parse(response.text) as unknown, request);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
