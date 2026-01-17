// /pages/api/marketing/generate-content.js
// API route for AI content generation using Fanar AI
import { verifyFirebaseIdToken } from '@/lib/firebase-edge';

const FANAR_BASE = 'https://api.fanar.qa/v1';
const MODEL_CHAT = 'Fanar-C-2-27B';
const FANAR_ORG = (process.env.FANAR_ORG || '').trim();

function getFanarKey() {
  const key = (process.env.FANAR_API_KEY || '').trim();
  if (!key) throw new Error('Missing FANAR_API_KEY in environment');
  return key;
}

function commonAuthHeaders(extra = {}) {
  const h = { Authorization: `Bearer ${getFanarKey()}`, ...extra };
  if (FANAR_ORG) h['X-Organization'] = FANAR_ORG;
  return h;
}

async function fanarChat(messages, { max_tokens = 2000, temperature = 0.7 } = {}) {
  const body = { model: MODEL_CHAT, messages, max_tokens, temperature };
  const r = await fetch(`${FANAR_BASE}/chat/completions`, {
    method: 'POST',
    headers: { ...commonAuthHeaders({ 'Content-Type': 'application/json' }) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export const config = { runtime: 'edge' };

// Note: verifyFirebaseIdToken is imported from lib/firebase-edge.js which uses JOSE for edge runtime

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auth: expect Firebase ID token
    const authz = req.headers.get('authorization') || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Authorization Bearer token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const idToken = m[1];
    await verifyFirebaseIdToken(idToken);

    const body = await req.json();
    const { type, topic, language = 'ar', prompt } = body || {};

    if (!type || !topic) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing type or topic' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAr = language === 'ar';
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'article_content') {
      systemPrompt = isAr
        ? 'أنت كاتب طبي محترف متخصص في كتابة مقالات طبية واضحة ومفيدة للمرضى. اكتب محتوى طبي دقيق، سهل الفهم، ومنظم جيداً.'
        : 'You are a professional medical writer specializing in writing clear and useful medical articles for patients. Write accurate, easy-to-understand, and well-organized medical content.';
      userPrompt = isAr
        ? `اكتب مقال طبي كامل عن موضوع: "${topic}". يجب أن يكون المقال:\n- واضحاً وسهل الفهم للمرضى\n- منظم بعناوين فرعية\n- يحتوي على معلومات طبية دقيقة\n- يغطي الموضوع بشكل شامل\n${prompt ? `\nتعليمات إضافية: ${prompt}` : ''}`
        : `Write a complete medical article about: "${topic}". The article should be:\n- Clear and easy to understand for patients\n- Well-organized with subheadings\n- Contain accurate medical information\n- Cover the topic comprehensively\n${prompt ? `\nAdditional instructions: ${prompt}` : ''}`;
    } else if (type === 'article_summary') {
      systemPrompt = isAr
        ? 'أنت مساعد طبي متخصص في كتابة ملخصات موجزة وواضحة للمقالات الطبية.'
        : 'You are a medical assistant specialized in writing concise and clear summaries for medical articles.';
      userPrompt = isAr
        ? `اكتب ملخصاً موجزاً (2-3 جمل) للمقال عن: "${topic}".\n${prompt ? `\nالمحتوى: ${prompt}` : ''}`
        : `Write a brief summary (2-3 sentences) for an article about: "${topic}".\n${prompt ? `\nContent: ${prompt}` : ''}`;
    } else if (type === 'infographic_description') {
      systemPrompt = isAr
        ? 'أنت مساعد طبي متخصص في كتابة أوصاف واضحة للإنفوجرافيك الطبي.'
        : 'You are a medical assistant specialized in writing clear descriptions for medical infographics.';
      userPrompt = isAr
        ? `اكتب وصفاً للإنفوجرافيك عن: "${topic}". يجب أن يكون الوصف واضحاً وموجزاً.\n${prompt ? `\nتعليمات: ${prompt}` : ''}`
        : `Write a description for an infographic about: "${topic}". The description should be clear and concise.\n${prompt ? `\nInstructions: ${prompt}` : ''}`;
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const resp = await fanarChat(messages, { max_tokens: 2000, temperature: 0.7 });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: resp.data?.error?.message || resp.data?.message || 'Fanar request failed',
        }),
        {
          status: resp.status || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const content = resp.data?.choices?.[0]?.message?.content || '';
    return new Response(
      JSON.stringify({
        ok: true,
        content: content.trim(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('Content generation error:', e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(e?.message || e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
