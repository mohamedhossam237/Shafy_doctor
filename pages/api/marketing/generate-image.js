// /pages/api/marketing/generate-image.js
// API route for AI image generation using Gemini via OpenRouter
import { verifyFirebaseIdToken } from '@/lib/firebase-edge';
import { getOpenRouterClient } from '@/lib/ai';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Auth: expect Firebase ID token
    const authz = req.headers.authorization || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ ok: false, error: 'Missing Authorization Bearer token' });
    }
    const idToken = m[1];
    await verifyFirebaseIdToken(idToken);

    const { prompt, language = 'ar' } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ ok: false, error: 'Missing prompt' });
    }

    // Use OpenRouter with Gemini image generation
    // Note: Gemini doesn't directly generate images, but we can use other models via OpenRouter
    // For now, we'll use DALL-E or Stable Diffusion via OpenRouter
    // Check available image models: https://openrouter.ai/models?order=top&supporting=image-generation
    
    const client = getOpenRouterClient();
    
    // Try using a text-to-image model via OpenRouter
    // Common models: black-forest-labs/flux-1.1-pro, stability-ai/stable-diffusion-xl
    // Since Gemini doesn't do image generation, we'll use flux via OpenRouter
    try {
      // Use OpenAI-compatible image generation endpoint
      // Note: OpenRouter may not directly support image generation, so we'll use a workaround
      // For now, return an error with instructions to use image upload instead
      // TODO: Integrate with a proper image generation service
      
      return res.status(501).json({
        ok: false,
        error: 'Image generation via AI is not yet fully supported. Please upload an image manually or use image generation services.',
        suggestion: 'You can use tools like DALL-E, Midjourney, or Stable Diffusion to generate images and then upload them.',
      });
    } catch (e) {
      console.error('Image generation error:', e);
      return res.status(500).json({
        ok: false,
        error: String(e?.message || e),
      });
    }
  } catch (e) {
    console.error('Image generation API error:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
}
