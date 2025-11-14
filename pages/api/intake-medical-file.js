// pages/api/intake-medical-file.js
export const config = {
  runtime: "edge",
};

/* ============================================================
   FANAR CONFIG
============================================================ */
const FANAR_BASE = "https://api.fanar.qa/v1";
const FANAR_MODEL = "Fanar";
const MAX_CHARS_PER_CHUNK = 4000;

function getFanarKey() {
  const key = (process.env.FANAR_API_KEY || "").trim();
  if (!key) throw new Error("Missing FANAR_API_KEY");
  return key;
}

function fanarHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${getFanarKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function fanarChat(messages) {
  const resp = await fetch(`${FANAR_BASE}/chat/completions`, {
    method: "POST",
    headers: fanarHeaders(),
    body: JSON.stringify({
      model: FANAR_MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.1,
    }),
  });

  return {
    ok: resp.ok,
    status: resp.status,
    data: await resp.json().catch(() => null),
  };
}

/* ============================================================
   JSON CLEANER
============================================================ */
function safeExtractJson(text) {
  if (!text) return null;

  let cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]+\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/* ============================================================
   FILE → TEXT (Edge Runtime)
============================================================ */
async function extractText(buf, filename, mime) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buf);
}

/* ============================================================
   CHUNKING + MERGING
============================================================ */
function splitChunks(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHARS_PER_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHARS_PER_CHUNK));
  }
  return chunks;
}

function clean(v) {
  if (!v) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function makeEmpty() {
  return {
    allergies: [],
    conditions: [],
    medications: [],
    diagnosis: "",
    findings: "",
    procedures: "",
    notes: "",
    labResults: [],
    age: "",
    gender: "",
    maritalStatus: "",
    bloodType: "",
  };
}

function merge(parts) {
  const out = makeEmpty();

  const mergeArr = (target, src) => {
    (src || []).forEach((v) => {
      const s = clean(v);
      if (s && !target.includes(s)) target.push(s);
    });
  };

  for (const p of parts) {
    if (!p) continue;

    mergeArr(out.allergies, p.allergies);
    mergeArr(out.conditions, p.conditions);
    mergeArr(out.medications, p.medications);

    ["diagnosis", "findings", "procedures", "notes"].forEach((key) => {
      if (clean(p[key])) {
        out[key] = out[key]
          ? `${out[key]}\n${clean(p[key])}`
          : clean(p[key]);
      }
    });

    if (Array.isArray(p.labResults)) {
      out.labResults.push(...p.labResults);
    }

    if (!out.age && p.age) out.age = clean(p.age);
    if (!out.gender && p.gender) out.gender = clean(p.gender);
    if (!out.maritalStatus && p.maritalStatus) out.maritalStatus = clean(p.maritalStatus);
    if (!out.bloodType && p.bloodType) out.bloodType = clean(p.bloodType);
  }

  return out;
}

/* ============================================================
   NOTES BUILDER
============================================================ */
function buildNotes(e) {
  const parts = [];

  const add = (label, arr) => {
    const list = (arr || []).filter(Boolean);
    if (list.length) parts.push(`${label}: ${list.join(", ")}`);
  };

  add("Allergies", e.allergies);
  add("Conditions", e.conditions);
  add("Medications", e.medications);

  if (e.diagnosis) parts.push(`Diagnosis: ${e.diagnosis}`);
  if (e.findings) parts.push(`Findings: ${e.findings}`);
  if (e.procedures) parts.push(`Procedures: ${e.procedures}`);

  if (clean(e.notes)) parts.push(`Other notes: ${clean(e.notes)}`);

  return parts.join("\n");
}

/* ============================================================
   FIREBASE TOKEN VERIFY — Edge Runtime
============================================================ */
import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

async function verifyToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  return payload.user_id;
}

/* ============================================================
   FIRESTORE UPDATE (REST API)
============================================================ */
async function updateFirestore(token, patientId, extracted) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/patients/${patientId}?` +
    [
      "updateMask.fieldPaths=allergies",
      "updateMask.fieldPaths=conditions",
      "updateMask.fieldPaths=medications",
      "updateMask.fieldPaths=diagnosis",
      "updateMask.fieldPaths=findings",
      "updateMask.fieldPaths=procedures",
      "updateMask.fieldPaths=notes",
    ].join("&");

  const arr = (lst = []) => ({
    arrayValue: { values: lst.map((v) => ({ stringValue: v })) },
  });

  const body = {
    fields: {
      allergies: arr(extracted.allergies),
      conditions: arr(extracted.conditions),
      medications: arr(extracted.medications),
      diagnosis: { stringValue: extracted.diagnosis },
      findings: { stringValue: extracted.findings },
      procedures: { stringValue: extracted.procedures },
      notes: { stringValue: extracted.notes },
    },
  };

  await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/* ============================================================
   FANAR EXTRACTION
============================================================ */
async function extractWithFanar(text) {
  const chunks = splitChunks(text);
  const results = [];

  for (const chunk of chunks) {
    let attempts = 0;
    let json = null;
    let raw = "";

    while (!json && attempts < 3) {
      attempts++;

      const resp = await fanarChat([
        { role: "system", content: "Return ONLY valid JSON" },
        { role: "user", content: chunk },
      ]);

      raw = resp.data?.choices?.[0]?.message?.content || "";
      json = safeExtractJson(raw);
    }

    if (!json) json = makeEmpty();
    results.push(json);
  }

  return merge(results);
}

/* ============================================================
   MAIN HANDLER — EDGE RUNTIME
============================================================ */
export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }

    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token)
      return new Response(JSON.stringify({ error: "Missing Token" }), { status: 401 });

    await verifyToken(token);

    const form = await req.formData();
    const file = form.get("file");
    const patientId = form.get("patientId");

    if (!patientId)
      return new Response(JSON.stringify({ error: "Missing patientId" }), { status: 400 });

    if (!file)
      return new Response(JSON.stringify({ error: "Missing file" }), { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const rawText = await extractText(arrayBuffer, file.name, file.type);

    let extracted = makeEmpty();

    if (rawText.trim().length > 5) {
      extracted = await extractWithFanar(rawText);
    }

    extracted.notes = buildNotes(extracted);

    await updateFirestore(token, patientId, extracted);

    return new Response(JSON.stringify({ ok: true, extracted }), { status: 200 });
  } catch (err) {
    console.error("ERROR:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
}
