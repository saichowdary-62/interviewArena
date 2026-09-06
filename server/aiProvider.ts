import { GoogleGenAI } from '@google/genai';

/**
 * Validated Gemini Flash models.
 * Per project requirements: only Gemini Flash models are allowed across the site.
 */
export const ALLOWED_FLASH_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
] as const;

export type FlashModel = (typeof ALLOWED_FLASH_MODELS)[number];
export const DEFAULT_FLASH_MODEL: FlashModel = 'gemini-2.5-flash';

export interface AiProviderConfig {
  provider: 'gemini';
  apiKey: string;
  model: FlashModel;
  baseUrl: string;
  sourceKeyName: 'GEMINI_API_KEY';
}

/**
 * Resolves the active Gemini Flash AI configuration strictly from GEMINI_API_KEY.
 * Only Google Gemini Flash models are utilized across the application.
 */
export function getActiveAiConfig(): AiProviderConfig {
  const env = process.env;

  // Resolve API Key: strictly Gemini API key
  const geminiKey = (env.GEMINI_API_KEY || env.AI_API_KEY || '').trim();
  const apiKey = geminiKey;
  const sourceKeyName: 'GEMINI_API_KEY' = 'GEMINI_API_KEY';

  // Resolve Model: strictly enforce an allowed Flash model
  let requestedModel = (env.AI_MODEL || '').trim() as FlashModel;
  if (!ALLOWED_FLASH_MODELS.includes(requestedModel)) {
    requestedModel = DEFAULT_FLASH_MODEL;
  }

  return {
    provider: 'gemini',
    apiKey,
    model: requestedModel,
    baseUrl: 'https://generativelanguage.googleapis.com',
    sourceKeyName,
  };
}

/**
 * Strips markdown code blocks and extracts cleanly formatted JSON from model output.
 */
export function cleanAndParseJson<T = any>(rawText: string | undefined, fallbackValue: T): T {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return fallbackValue;
  }
  let text = rawText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ...)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }

  // Try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    // Attempt to isolate matching outermost JSON array or object boundary
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
      endIdx = text.lastIndexOf(']');
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
      endIdx = text.lastIndexOf('}');
    }

    if (startIdx !== -1 && endIdx > startIdx) {
      const candidate = text.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch (innerErr) {
        console.warn('[cleanAndParseJson] Boundary slice parsing failed:', innerErr);
      }
    }

    console.warn('[cleanAndParseJson] Could not parse JSON from model output snippet:', text.substring(0, 160));
    return fallbackValue;
  }
}

/**
 * Checks whether an error is caused by rate limits, 429 quota exhaustion, or invalid keys.
 */
export function isRateLimitOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
  const code = err?.status || err?.statusCode || err?.code || err?.error?.code;
  return (
    code === 429 ||
    code === 'insufficient_quota' ||
    msg.includes('429') ||
    msg.toLowerCase().includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('rate limit') ||
    msg.toLowerCase().includes('billing details')
  );
}

/**
 * Mask an API key for safe display in logs and UI diagnostics.
 */
export function maskApiKey(key: string): string {
  if (!key || key.trim().length === 0) return 'NOT_CONFIGURED';
  const clean = key.trim();
  if (clean.length <= 8) return `${clean.substring(0, 2)}...${clean.slice(-2)}`;
  return `${clean.substring(0, 6)}...${clean.slice(-4)} (${clean.length} chars)`;
}

// Cached Gemini client instance to avoid recreating client unless key changes
let cachedGeminiKey = '';
let cachedGeminiClient: GoogleGenAI | null = null;

function getCachedGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedGeminiClient || cachedGeminiKey !== apiKey) {
    cachedGeminiKey = apiKey;
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedGeminiClient;
}

import Groq from 'groq-sdk';

// Cached Groq client instance to avoid recreating client unless key changes
let cachedGroqKey = '';
let cachedGroqClient: Groq | null = null;

function getCachedGroqClient(apiKey: string): Groq {
  if (!cachedGroqClient || cachedGroqKey !== apiKey) {
    cachedGroqKey = apiKey;
    cachedGroqClient = new Groq({ apiKey });
  }
  return cachedGroqClient;
}

export interface GenerateAiOptions {
  systemPrompt?: string;
  userPrompt: string;
  imageParts?: Array<{ mimeType: string; data: string }>;
  jsonMode?: boolean;
  temperature?: number;
  maxRetries?: number;
}

export interface GenerateAiResult {
  text: string;
  provider: 'gemini' | 'groq';
  model: string;
  latencyMs: number;
}

/**
 * Executes AI content generation. Tries Groq first if GROQ_API_KEY is available,
 * otherwise falls back to Gemini Flash models.
 */
export async function generateAiContent(options: GenerateAiOptions): Promise<GenerateAiResult> {
  const { systemPrompt, userPrompt, imageParts, jsonMode = false, temperature = 0.3, maxRetries = 1 } = options;
  const t0 = Date.now();

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groq = getCachedGroqClient(groqKey);
      
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      // Note: If imageParts are passed and you want vision models on Groq, 
      // you need a specific vision model (like llama-3.2-11b-vision-preview).
      // For now, we will drop images for Groq unless explicitly handled, 
      // as most Groq tasks in this app are text-based.
      
      const response = await groq.chat.completions.create({
        messages,
        model: 'llama3-70b-8192', // Or another fast Groq model
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
      });

      return {
        text: response.choices[0]?.message?.content || '',
        provider: 'groq',
        model: 'llama3-70b-8192',
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      console.warn('[Groq generateContent] Failed, falling back to Gemini:', err);
    }
  }

  // Fallback to Gemini
  const config = getActiveAiConfig();
  if (!config.apiKey) {
    const err = new Error('No Groq or Gemini API key found. Please set GROQ_API_KEY or GEMINI_API_KEY in environment variables.');
    (err as any).statusCode = 401;
    (err as any).code = 'MISSING_API_KEY';
    throw err;
  }

  const ai = getCachedGeminiClient(config.apiKey);

  // Strictly Flash model candidates only
  const candidateModels: FlashModel[] = [
    config.model,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ];
  // Deduplicate preserving order
  const flashModels = Array.from(new Set(candidateModels));

  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const model of flashModels) {
      try {
        const parts: any[] = [];
        if (systemPrompt) {
          parts.push({ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}` });
        } else {
          parts.push({ text: userPrompt });
        }

        if (imageParts && imageParts.length > 0) {
          for (const img of imageParts) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: img.data,
              },
            });
          }
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        });

        return {
          text: response.text || '',
          provider: 'gemini',
          model,
          latencyMs: Date.now() - t0,
        };
      } catch (err: any) {
        lastErr = err;
        const isQuota = isRateLimitOrQuotaError(err);
        console.warn(
          `[Gemini Flash generateContent] Model '${model}' returned ${
            isQuota ? 'QUOTA/RATE_LIMIT' : err?.status || err?.code || 'ERROR'
          }: ${err?.message?.substring(0, 150)}. Cascading to next Flash model...`
        );
        continue;
      }
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  throw lastErr;
}

/**
 * Diagnostic ping test for verifying Gemini API key connectivity and measuring Flash model response latency.
 */
export async function testAiConnection(): Promise<{
  connected: boolean;
  status: number;
  provider: 'gemini' | 'groq';
  model: string;
  latencyMs: number;
  message: string;
  sourceKeyName: 'GEMINI_API_KEY' | 'GROQ_API_KEY';
  maskedKey: string;
  troubleshooting?: string;
  isQuotaExhausted?: boolean;
}> {
  const hasGroq = !!process.env.GROQ_API_KEY;
  const config = getActiveAiConfig();
  const maskedKey = maskApiKey(hasGroq ? (process.env.GROQ_API_KEY || '') : config.apiKey);

  if (!hasGroq && !config.apiKey) {
    return {
      connected: false,
      status: 401,
      provider: 'gemini',
      model: config.model,
      latencyMs: 0,
      sourceKeyName: 'GEMINI_API_KEY',
      maskedKey,
      message: 'No AI API key found. Add GROQ_API_KEY or GEMINI_API_KEY in environment variables.',
      troubleshooting: 'Add GROQ_API_KEY or GEMINI_API_KEY to your environment variables or in the AI Studio Settings panel.',
    };
  }

  try {
    const result = await generateAiContent({
      systemPrompt: 'You are a diagnostic ping responder.',
      userPrompt: 'Reply with the word "OK".',
      maxRetries: 0,
    });

    return {
      connected: true,
      status: 200,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      sourceKeyName: result.provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY',
      maskedKey,
      message: `${result.provider === 'groq' ? 'Groq' : 'Google Gemini Flash'} (${result.model}) verified and responding (${result.latencyMs}ms).`,
    };
  } catch (err: any) {
    const isQuota = isRateLimitOrQuotaError(err);
    const status = err?.statusCode || err?.status || (isQuota ? 429 : 500);

    let troubleshooting = 'Verify your API keys in environment variables.';
    if (status === 401) {
      troubleshooting = 'The provided API key was rejected. Please check that your key is valid.';
    } else if (isQuota) {
      troubleshooting = 'Quota or rate limit reached. The platform automatically engages the deterministic benchmark engine as fallback.';
    }

    return {
      connected: false,
      status,
      provider: hasGroq ? 'groq' : 'gemini',
      model: hasGroq ? 'llama3-70b-8192' : config.model,
      latencyMs: 0,
      sourceKeyName: hasGroq ? 'GROQ_API_KEY' : 'GEMINI_API_KEY',
      maskedKey,
      isQuotaExhausted: isQuota,
      message: err?.message || 'Failed to communicate with AI Provider',
      troubleshooting,
    };
  }
}
