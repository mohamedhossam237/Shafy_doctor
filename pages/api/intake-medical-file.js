// pages/api/intake-medical-file.js

const Busboy = require("busboy");
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const config = { api: { bodyParser: false } };

// ===================================================================
// FANAR CONFIG
// ===================================================================

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

  const json = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data: json };
}

// ===================================================================
// SAFE JSON PARSER (Improved)
// ===================================================================

function safeExtractJson(text) {
  if (!text) return null;

  // cleanup
  let cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // find first {...}
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ===================================================================
// MULTIPART HANDLING
// ===================================================================

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    try {
      const busboy = Busboy({ headers: req.headers });
      let patientId = null;
      let filename = "";
      let mimeType = "";
      let fileBuffer = Buffer.alloc(0);

      busboy.on("field", (name, value) => {
        if (name === "patientId") patientId = value;
      });

      busboy.on("file", (name, file, info) => {
        if (name === "file") {
          filename = info.filename;
          mimeType = info.mimeType || info.mime || "";
          file.on("data", (d) => {
            fileBuffer = Buffer.concat([fileBuffer, d]);
          });
        } else {
          file.resume();
        }
      });

      busboy.on("finish", () => {
        resolve({ patientId, fileBuffer, filename, mimeType });
      });

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
}

// ===================================================================
// FILE → TEXT
// ===================================================================

async function extractTextFromBuffer(fileBuffer, filename, mimeType) {
  if (!fileBuffer?.length) return "";

  const name = (filename || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (name.endsWith(".docx")) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      return value || "";
    } catch {
      return fileBuffer.toString("utf8");
    }
  }

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    try {
      const data = await pdfParse(fileBuffer);
      return data.text || "";
    } catch {
      return fileBuffer.toString("utf8");
    }
  }

  return fileBuffer.toString("utf8");
}

// ===================================================================
// FIREBASE TOKEN VERIFY
// ===================================================================

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID;

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

// ===================================================================
// FIRESTORE PATCH
// ===================================================================

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
      "updateMask.fieldPaths=labResultsFromFile",
      "updateMask.fieldPaths=medicalFileUpdatedAt",
      "updateMask.fieldPaths=maritalStatus",
      "updateMask.fieldPaths=bloodType",
      "updateMask.fieldPaths=age",
      "updateMask.fieldPaths=gender",
    ].join("&");

  const arr = (list = []) => ({
    arrayValue: {
      values: (list || []).map((x) => ({ stringValue: x })),
    },
  });

  const body = {
    fields: {
      allergies: arr(extracted.allergies),
      conditions: arr(extracted.conditions),
      medications: arr(extracted.medications),
      diagnosis: { stringValue: extracted.diagnosis || "" },
      findings: { stringValue: extracted.findings || "" },
      procedures: { stringValue: extracted.procedures || "" },
      notes: { stringValue: extracted.notes || "" },
      labResultsFromFile: {
        arrayValue: {
          values: (extracted.labResults || []).map((x) => ({
            mapValue: {
              fields: {
                test: { stringValue: x.test || "" },
                value: { stringValue: x.value || "" },
                unit: { stringValue: x.unit || "" },
                referenceRange: { stringValue: x.referenceRange || "" },
                flag: { stringValue: x.flag || "" },
              },
            },
          })),
        },
      },
      medicalFileUpdatedAt: {
        timestampValue: new Date().toISOString(),
      },
      maritalStatus: { stringValue: extracted.maritalStatus || "" },
      bloodType: { stringValue: extracted.bloodType || "" },
      age: { integerValue: extracted.age || "0" },
      gender: { stringValue: extracted.gender || "" },
    },
  };

  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(txt);
  }
}

// ===================================================================
// CHUNKING + MERGING
// ===================================================================

function splitChunks(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHARS_PER_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHARS_PER_CHUNK));
  }
  return chunks;
}

function clean(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
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

  const mergeArr = (target, source) => {
    (source || []).forEach((v) => {
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
        out[key] = out[key] ? out[key] + "\n" + clean(p[key]) : clean(p[key]);
      }
    });

    if (Array.isArray(p.labResults)) {
      out.labResults.push(...p.labResults);
    }

    if (!out.age && p.age) out.age = clean(p.age);
    if (!out.gender && p.gender) out.gender = clean(p.gender);
    if (!out.maritalStatus && p.maritalStatus)
      out.maritalStatus = clean(p.maritalStatus);
    if (!out.bloodType && p.bloodType) out.bloodType = clean(p.bloodType);
  }

  return out;
}

// ===================================================================
// BUILD NOTES
// ===================================================================

function buildNotesFromExtract(extracted) {
  const parts = [];

  const add = (label, arr) => {
    const list = (arr || []).filter(Boolean);
    if (list.length) parts.push(`${label}: ${list.join(", ")}`);
  };

  add("Allergies", extracted.allergies);
  add("Conditions", extracted.conditions);
  add("Medications", extracted.medications);

  if (extracted.diagnosis) parts.push(`Diagnosis: ${extracted.diagnosis}`);
  if (extracted.findings) parts.push(`Findings: ${extracted.findings}`);
  if (extracted.procedures) parts.push(`Procedures: ${extracted.procedures}`);

  if (Array.isArray(extracted.labResults) && extracted.labResults.length) {
    parts.push("Lab Results:");
    extracted.labResults.forEach((lr) => {
      parts.push(
        `- Test: ${lr.test}, Value: ${lr.value}, Unit: ${lr.unit}, Flag: ${lr.flag}`
      );
    });
  }

  if (clean(extracted.notes)) {
    parts.push(`Other notes: ${clean(extracted.notes)}`);
  }

  return parts.join("\n");
}

// ===================================================================
// FANAR EXTRACTION (FINAL FIXED VERSION)
// ===================================================================

async function extractWithFanar(text) {
  const chunks = splitChunks(text);
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const system = `
Extract ONLY medical information. 
Return EXACT valid JSON structure without extra text.
`.trim();

    let attempt = 0;
    let json = null;
    let raw = "";

    while (attempt < 3 && !json) {
      attempt++;

      const resp = await fanarChat([
        { role: "system", content: system },
        { role: "user", content: chunks[i] },
      ]);

      raw = resp.data?.choices?.[0]?.message?.content || "";

      json = safeExtractJson(raw);

      if (!json) {
        console.warn(`⚠️ INVALID JSON (attempt ${attempt}):`, raw);
      }
    }

    if (!json) {
      console.error("❌ Fanar returned INVALID JSON after 3 attempts.");
      json = makeEmpty();
    }

    results.push(json);
  }

  return merge(results);
}

// ===================================================================
// MAIN ROUTE
// ===================================================================

export default async function handler(req, res) {
  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method Not Allowed" });

    const token = req.headers.authorization?.replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "Missing Token" });

    await verifyToken(token);

    const { patientId, fileBuffer, filename, mimeType } =
      await parseMultipart(req);

    if (!patientId) return res.status(400).json({ error: "Missing patientId" });
    if (!fileBuffer?.length)
      return res.status(400).json({ error: "Missing file" });

    const raw = await extractTextFromBuffer(fileBuffer, filename, mimeType);
    const cleanText = raw.replace(/\s+/g, " ").trim();

    if (!cleanText) {
      const emptyExtract = makeEmpty();
      emptyExtract.notes = "";
      await updateFirestore(token, patientId, emptyExtract);
      return res.status(200).json({
        ok: true,
        extracted: emptyExtract,
        warning: "No text extracted",
      });
    }

    let extracted = makeEmpty();

    try {
      extracted = await extractWithFanar(cleanText);
    } catch (e) {
      console.error("❌ AI extraction failed:", e);
      extracted = makeEmpty();
    }

    extracted.notes = buildNotesFromExtract(extracted);

    await updateFirestore(token, patientId, extracted);

    res.status(200).json({ ok: true, extracted });
  } catch (e) {
    console.error("SERVER ERROR:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
