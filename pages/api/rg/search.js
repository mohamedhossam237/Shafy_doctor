// /pages/api/rg/search.js
import { getQdrant } from '@/lib/qdrant';
import { embedQuery } from '@/lib/embeddings';
import { authAdmin } from '@/lib/firebaseAdmin'; // للتحقق من توكن Firebase

// ملاحظة: هذا الراوت يعمل على بيئة Node (وليس Edge) لأن fastembed يعمل Node فقط.

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m?.[1] || null;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // ====== التوثيق ======
    const token = bearer(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Firebase ID token' });
    const decoded = await authAdmin.verifyIdToken(token).catch(() => null);
    if (!decoded?.uid) return res.status(401).json({ ok: false, error: 'Invalid Firebase ID token' });
    const doctorUID = decoded.uid;

    // ====== إدخال المستخدم ======
    const body = req.method === 'POST' ? (req.body || {}) : {};
    const q =
      typeof (req.query.q ?? body.q) === 'string'
        ? String(req.query.q ?? body.q).trim()
        : '';

    if (!q) return res.status(400).json({ ok: false, error: 'Missing q' });

    const limit = clamp(req.query.limit ?? body.limit ?? 10, 1, 50);
    const offset = clamp(req.query.offset ?? body.offset ?? 0, 0, 10_000);

    const type = String(req.query.type ?? body.type ?? '').trim(); // 'patient' | 'report' | 'lab'
    const patientId = String(req.query.patientId ?? body.patientId ?? '').trim();
    const patientName = String(req.query.patientName ?? body.patientName ?? '').trim();
    const date = String(req.query.date ?? body.date ?? '').trim(); // YYYY-MM-DD exact match
    const scoreThresholdRaw = Number(req.query.scoreThreshold ?? body.scoreThreshold);
    const score_threshold =
      Number.isFinite(scoreThresholdRaw) ? scoreThresholdRaw : undefined; // مثال: 0.25

    // ====== فلتر Qdrant بالـ payload ======
    const must = [{ key: 'doctorUID', match: { value: doctorUID } }];

    if (type && ['patient', 'report', 'lab'].includes(type)) {
      must.push({ key: 'type', match: { value: type } });
    }
    if (patientId) {
      // موجود على type=patient في reindex (payload.patientId)
      must.push({ key: 'patientId', match: { value: patientId } });
    }
    if (patientName) {
      // موجود على التقارير/اللاب (payload.patientName)
      must.push({ key: 'patientName', match: { value: patientName } });
    }
    if (date) {
      // خزّنا التاريخ كـ String "YYYY-MM-DD" — فلتر مساواة تامة
      must.push({ key: 'date', match: { value: date } });
    }

    const filter = { must };

    // ====== التضمين + البحث ======
    const client = getQdrant();
    const vector = await embedQuery(q);

    const searchReq = {
      vector,
      limit,
      offset,
      with_payload: true,
      with_vectors: false,
      filter,
    };

    if (typeof score_threshold === 'number') {
      searchReq.score_threshold = score_threshold;
    }

    const result = await client.search(process.env.QDRANT_COLLECTION, searchReq);

    // إعادة تنسيق النتيجة (اختياري): id, score, payload فقط
    const matches = (Array.isArray(result) ? result : []).map((m) => ({
      id: m.id,
      score: m.score,
      payload: m.payload,
    }));

    return res.status(200).json({
      ok: true,
      count: matches.length,
      matches,
    });
  } catch (e) {
    console.error('rg/search error:', e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
