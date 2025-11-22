import formidable from "formidable";
import fs from "fs";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const config = {
  api: {
    bodyParser: false
  }
};

// ===============================================================
// FANAR CONFIG
// ===============================================================

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
    ...extra
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
      temperature: 0.1
    })
  });

  const json = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data: json };
}

// ===============================================================
// SAFE JSON
// ===============================================================

function safeExtractJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = text.match(/\{[\s\S]+\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ===============================================================
// MULTIPART PARSER (FORMIDABLE)
// ===============================================================

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);

      const patientId = Array.isArray(fields.patientId)
        ? fields.patientId[0]
        : fields.patientId;

      let file = files.file;
      if (Array.isArray(file)) file = file[0];

      if (!file) return reject(new Error("File not found"));
      if (!file.filepath) return reject(new Error("Uploaded file has no filepath"));

      let fileBuffer;
      try {
        fileBuffer = fs.readFileSync(file.filepath);
      } catch (e) {
        return reject(new Error("Cannot read uploaded file"));
      }

      resolve({
        patientId,
        fileBuffer,
        filename: file.originalFilename || "",
        mimeType: file.mimetype || ""
      });
    });
  });
}

// ===============================================================
// FILE TO TEXT
// ===============================================================

async function extractTextFromBuffer(fileBuffer, filename, mimeType) {
  if (!fileBuffer || !fileBuffer.length) return "";

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

// ===============================================================
// FIREBASE TOKEN VERIFICATION
// ===============================================================

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
    audience: FIREBASE_PROJECT_ID
  });

  return payload.user_id;
}

// ===============================================================
// FIRESTORE MERGE HELPERS
// ===============================================================

function convertFirestoreDocument(fields = {}) {
  const out = {};

  for (const key in fields) {
    const v = fields[key];

    if (v.stringValue !== undefined) out[key] = v.stringValue;
    else if (v.integerValue !== undefined) out[key] = v.integerValue;
    else if (v.arrayValue !== undefined) {
      out[key] = (v.arrayValue.values || []).map(x => x.stringValue || "");
    }
    else if (v.mapValue !== undefined) {
      out[key] = convertFirestoreDocument(v.mapValue.fields);
    }
    else out[key] = "";
  }

  return out;
}

function toFirestoreFields(data) {
  const fields = {};

  for (const key in data) {
    const val = data[key];

    if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(x => ({ stringValue: String(x) }))
        }
      };
    } else {
      fields[key] = { stringValue: String(val || "") };
    }
  }

  return fields;
}

function mergeArrays(oldArr = [], newArr = []) {
  const set = new Set([
    ...oldArr.map(x => x.trim()),
    ...newArr.map(x => x.trim())
  ]);
  return Array.from(set).filter(Boolean);
}

function mergeLabResults(oldList = [], newList = []) {
  const merged = [...oldList];

  for (const item of newList) {
    const exists = merged.some(
      x => x.test.toLowerCase() === (item.test || "").toLowerCase()
    );
    if (!exists) merged.push(item);
  }

  return merged;
}

// ===============================================================
// UPDATE FIRESTORE (MERGE, DO NOT DELETE OLD DATA)
// ===============================================================

async function updateFirestore(token, patientId, extracted) {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/patients/${patientId}`;

  const existingRes = await fetch(docUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  let existing = {};
  if (existingRes.ok) {
    const json = await existingRes.json();
    existing = convertFirestoreDocument(json.fields || {});
  }

  const merged = {
    allergies: mergeArrays(existing.allergies, extracted.allergies),
    conditions: mergeArrays(existing.conditions, extracted.conditions),
    medications: mergeArrays(existing.medications, extracted.medications),

    notes: [
      existing.notes || "",
      extracted.notes || ""
    ].filter(Boolean).join("\n"),

    diagnosis: extracted.diagnosis || existing.diagnosis || "",
    findings: extracted.findings || existing.findings || "",
    procedures: extracted.procedures || existing.procedures || "",

    labResults: mergeLabResults(existing.labResults, extracted.labResults),

    age: extracted.age || existing.age || "",
    gender: extracted.gender || existing.gender || "",
    bloodType: extracted.bloodType || existing.bloodType || "",
    maritalStatus: extracted.maritalStatus || existing.maritalStatus || "",

    medicalFileUpdatedAt: new Date().toISOString()
  };

  const body = {
    fields: toFirestoreFields(merged)
  };

  const r = await fetch(docUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }
}

// ===============================================================
// TEXT CLEANING + CHUNKING
// ===============================================================

function clean(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function splitChunks(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHARS_PER_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHARS_PER_CHUNK));
  }
  return chunks;
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
    bloodType: ""
  };
}

// ===============================================================
// FANAR EXTRACTION
// ===============================================================

async function extractWithFanar(text) {
  const chunks = splitChunks(text);
  const results = [];

  const system = `
Extract only medical information.
Remove personal identifiers.
Return strict JSON:
{
  "allergies": [],
  "conditions": [],
  "medications": [],
  "diagnosis": "",
  "findings": "",
  "procedures": "",
  "notes": "",
  "labResults": [],
  "age": "",
  "gender": "",
  "maritalStatus": "",
  "bloodType": ""
}
`;

  for (let i = 0; i < chunks.length; i++) {
    const resp = await fanarChat([
      { role: "system", content: system },
      { role: "user", content: chunks[i] }
    ]);

    if (!resp.ok) throw new Error("Fanar API error");

    const raw = resp.data?.choices?.[0]?.message?.content || "";
    const json = safeExtractJson(raw);
    if (!json) throw new Error("Invalid JSON");

    results.push(json);
  }

  return mergeExtract(results);
}

function mergeExtract(parts) {
  const out = makeEmpty();

  const appendArray = (target, arr) => {
    (arr || []).forEach(v => {
      const s = clean(v);
      if (s && !target.includes(s)) target.push(s);
    });
  };

  for (const p of parts) {
    appendArray(out.allergies, p.allergies);
    appendArray(out.conditions, p.conditions);
    appendArray(out.medications, p.medications);

    ["diagnosis", "findings", "procedures", "notes"].forEach(key => {
      if (p[key]) {
        const val = clean(p[key]);
        if (val) {
          out[key] = out[key] ? out[key] + "\n" + val : val;
        }
      }
    });

    if (Array.isArray(p.labResults)) {
      out.labResults.push(
        ...p.labResults.map(x => ({
          test: clean(x.test),
          value: clean(x.value),
          unit: clean(x.unit),
          referenceRange: clean(x.referenceRange),
          flag: clean(x.flag)
        }))
      );
    }

    if (!out.age && p.age) out.age = clean(p.age);
    if (!out.gender && p.gender) out.gender = clean(p.gender);
    if (!out.maritalStatus && p.maritalStatus)
      out.maritalStatus = clean(p.maritalStatus);
    if (!out.bloodType && p.bloodType)
      out.bloodType = clean(p.bloodType);
  }

  return out;
}

// ===============================================================
// BUILD NOTES
// ===============================================================

function buildNotes(extracted) {
  const parts = [];

  const pushArr = (label, arr) => {
    const items = (arr || []).map(clean).filter(Boolean);
    if (items.length) {
      parts.push(label + ": " + items.join(", "));
    }
  };

  pushArr("Allergies", extracted.allergies);
  pushArr("Conditions", extracted.conditions);
  pushArr("Medications", extracted.medications);

  if (clean(extracted.diagnosis))
    parts.push("Diagnosis: " + clean(extracted.diagnosis));
  if (clean(extracted.findings))
    parts.push("Findings: " + clean(extracted.findings));
  if (clean(extracted.procedures))
    parts.push("Procedures: " + clean(extracted.procedures));

  if (Array.isArray(extracted.labResults)) {
    const lines = extracted.labResults.map(lr => {
      const seg = [];
      if (clean(lr.test)) seg.push("Test: " + clean(lr.test));
      if (clean(lr.value)) seg.push("Value: " + clean(lr.value));
      if (clean(lr.unit)) seg.push("Unit: " + clean(lr.unit));
      if (clean(lr.flag)) seg.push("Flag: " + clean(lr.flag));
      return seg.length ? "- " + seg.join(", ") : null;
    }).filter(Boolean);

    if (lines.length) {
      parts.push("Lab Results:");
      parts.push(...lines);
    }
  }

  if (clean(extracted.notes))
    parts.push("Other notes: " + clean(extracted.notes));

  return parts.join("\n").trim();
}

// ===============================================================
// MAIN HANDLER
// ===============================================================

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    await verifyToken(token);

    const { patientId, fileBuffer, filename, mimeType } =
      await parseMultipart(req);

    if (!patientId) {
      return res.status(400).json({ error: "Missing patientId" });
    }

    const raw = await extractTextFromBuffer(fileBuffer, filename, mimeType);
    const cleanText = (raw || "").replace(/\s+/g, " ").trim();

    if (!cleanText) {
      const emptyData = makeEmpty();
      await updateFirestore(token, patientId, emptyData);
      return res.status(200).json({
        ok: true,
        extracted: emptyData,
        warning: "No text extracted"
      });
    }

    let extracted = makeEmpty();

    try {
      extracted = await extractWithFanar(cleanText);
    } catch {
      extracted = makeEmpty();
    }

    extracted.notes = buildNotes(extracted);

    await updateFirestore(token, patientId, extracted);

    return res.status(200).json({
      ok: true,
      extracted
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({
      ok: false,
      error: e.message || "Server error"
    });
  }
}
