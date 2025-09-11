// Centralized OpenRouter client (one key for text + images)
import OpenAI from 'openai';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Models picked by capability; still a single OpenRouter key
export const TEXT_MODEL   = 'deepseek/deepseek-r1';
export const VISION_MODEL = 'google/gemini-1.5-flash'; // vision-capable

export function getOpenRouterClient() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY,
    // OpenRouter-specific headers are optional but nice to have
    defaultHeaders: {
      ...(process.env.OPENROUTER_APP_NAME
        ? { 'X-Title': process.env.OPENROUTER_APP_NAME }
        : {}),
      ...(process.env.OPENROUTER_SITE_URL
        ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL }
        : {}),
    },
  });
}
