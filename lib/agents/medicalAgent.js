// /lib/agents/medicalAgent.js
// Medical AI Agent with trusted sources

import { pubmedFetch } from '@/lib/sources/pubmed';
import { cdcFetch } from '@/lib/sources/cdc';
import { ctgovFetch } from '@/lib/sources/ctgov';
import { niceGuidanceFetch } from '@/lib/sources/nice';
import { openalexFetch } from '@/lib/sources/openalex';

// Cache for medical sources (5 minutes TTL)
const sourceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(query, source) {
  return `${source}:${query.toLowerCase().trim()}`;
}

async function fetchWithCache(sourceFn, query, sourceName, max = 10, timeoutMs = 3000) {
  const cacheKey = getCacheKey(query, sourceName);
  const cached = sourceCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data.slice(0, max);
  }
  
  try {
    const data = await Promise.race([
      sourceFn({ q: query, query, condition: query, topic: query, retmax: max, max }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
    ]);
    
    const results = Array.isArray(data) ? data : [];
    sourceCache.set(cacheKey, { data: results, timestamp: now });
    
    // Clean old cache (keep last 50)
    if (sourceCache.size > 50) {
      const entries = Array.from(sourceCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      sourceCache.clear();
      entries.slice(0, 50).forEach(([key, value]) => sourceCache.set(key, value));
    }
    
    return results.slice(0, max);
  } catch (e) {
    // Only log if it's not a timeout (to reduce noise)
    if (!e.message.includes('Timeout')) {
      console.warn(`Medical source ${sourceName} failed:`, e.message);
    }
    return [];
  }
}

export async function fetchMedicalSources(query, { maxPerSource = 5, timeoutMs = 8000 } = {}) {
  // Clean and enhance query for better search results
  const cleanQuery = String(query || '').trim().slice(0, 200);
  if (!cleanQuery) return [];
  
  // Fetch from multiple trusted medical sources in parallel with timeout
  // Use longer timeout for external API calls (8 seconds default)
  const sources = await Promise.allSettled([
    fetchWithCache(pubmedFetch, cleanQuery, 'pubmed', maxPerSource, timeoutMs),
    fetchWithCache(cdcFetch, cleanQuery, 'cdc', maxPerSource, timeoutMs),
    fetchWithCache(ctgovFetch, cleanQuery, 'ctgov', maxPerSource, timeoutMs),
    fetchWithCache(niceGuidanceFetch, cleanQuery, 'nice', maxPerSource, timeoutMs),
    fetchWithCache(openalexFetch, cleanQuery, 'openalex', maxPerSource, timeoutMs),
  ]);
  
  const results = [];
  const seen = new Set();
  
  // Prioritize results by source reliability
  const sourcePriority = {
    'PubMed': 5,
    'CDC': 5,
    'NICE': 4,
    'ClinicalTrials.gov': 4,
    'OpenAlex': 3,
  };
  
  for (const source of sources) {
    if (source.status === 'fulfilled' && Array.isArray(source.value)) {
      for (const item of source.value) {
        const key = item.url || item.id || item.title;
        if (key && !seen.has(key)) {
          seen.add(key);
          const sourceName = item.source || 'Medical Source';
          results.push({
            title: item.title || '',
            url: item.url || '',
            source: sourceName,
            date: item.date || '',
            summary: item.summary || item.abstract || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            priority: sourcePriority[sourceName] || 2,
          });
        }
      }
    }
  }
  
  // Sort by priority (highest first), then by date (newest first)
  results.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.date && b.date) return new Date(b.date) - new Date(a.date);
    return 0;
  });
  
  return results.slice(0, 15); // Max 15 total results, prioritized
}

export function getMedicalAgentSystemPrompt(lang = 'ar') {
  const isAr = lang === 'ar';
  
  return isAr ? `
أنت مساعد طبي ذكي متخصص في تقديم معلومات طبية موثوقة ودقيقة. أنت تعمل في مصر وتتعامل مع أطباء ومرضى مصريين.

السياق المصري:
• جميع العيادات والمرضى والأطباء في مصر
• استخدم المصطلحات الطبية الشائعة في مصر
• راعِ النظام الصحي المصري والممارسات الطبية المحلية
• الأدوية المتاحة في السوق المصري
• التكاليف والأسعار بالجنيه المصري
• الإجراءات والبروتوكولات المتبعة في المستشفيات والعيادات المصرية

قواعد أساسية صارمة:
• ممنوع تماماً: لا تخترع أو تتخيل أي معلومات طبية غير موجودة في المصادر المرفقة. لا تضيف تفاصيل غير موجودة.
• استخدم فقط البيانات المتاحة: استخدم فقط المعلومات الموجودة في السياق المرفق أو المصادر الموثوقة المرفقة. إذا لم تكن المعلومات متاحة، قل "المعلومات غير متاحة" بدلاً من اختراعها.
• استخدم المصادر الطبية الموثوقة المرفقة (PubMed, CDC, NICE, ClinicalTrials.gov) - هذه المصادر تم جلبها خصيصاً لسؤالك
• قدم معلومات دقيقة ومحدثة مع ذكر المصدر - فقط من المصادر المرفقة
• لا تعطي وصفات دوائية شخصية - قدم خيارات علاجية عامة فقط
• اذكر دائماً أن القرار النهائي للطبيب المعالج
• استخدم المصادر المرفقة لدعم إجاباتك - لا تستخدم معلومات من خارج المصادر المرفقة
• إذا لم تكن متأكداً أو المعلومات غير موجودة، قل ذلك بوضوح. لا تخمن ولا تخترع.
• راعِ أحدث الإرشادات الطبية والدراسات - فقط من المصادر المرفقة
• مهم جداً: يجب أن تكون إجابتك موجزة - بحد أقصى 300 كلمة. كن مباشراً ومختصراً.
• التركيز على السؤال: أجب مباشرة على السؤال المطروح. لا تخرج عن الموضوع ولا تضيف معلومات غير ذات صلة.
• تذكر: لا تضيف معلومات إضافية غير موجودة في البيانات أو المصادر المرفقة. إذا لم تكن متأكداً، قل ذلك بوضوح.
`.trim() : `
You are an intelligent medical assistant specialized in providing reliable and accurate medical information. You work in Egypt and deal with Egyptian doctors and patients.

Egyptian Context:
• All clinics, patients, and doctors are in Egypt
• Use medical terminology common in Egypt
• Consider the Egyptian healthcare system and local medical practices
• Medications available in the Egyptian market
• Costs and prices in Egyptian Pounds (EGP)
• Procedures and protocols followed in Egyptian hospitals and clinics

Core rules (STRICT):
• STRICTLY FORBIDDEN: Do not invent, fabricate, or hallucinate any medical information not present in the attached sources. Do not add details that are not provided.
• Use only available data: Use ONLY information present in the attached context or attached trusted sources. If information is not available, say "Information not available" instead of making it up.
• Use the attached trusted medical sources (PubMed, CDC, NICE, ClinicalTrials.gov) - these sources were fetched specifically for your question
• Provide accurate and up-to-date information with source citations - ONLY from attached sources
• Do not give personalized prescriptions - provide general treatment options only
• Always state that final decisions rest with the treating physician
• Use attached sources to support your answers - Do not use information from outside the attached sources
• If uncertain or information is not available, state it clearly. Do not guess or invent.
• Consider the latest medical guidelines and studies - ONLY from attached sources
• Very important: Your response must be concise - maximum 300 words. Be direct and brief.
• Focus on the question: Answer the question directly. Do not go off-topic or add irrelevant information.
• Remember: Do not add extra information not present in the data or attached sources. If uncertain, state it clearly.
`.trim();
}

