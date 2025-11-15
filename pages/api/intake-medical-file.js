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

// ===================================================================
// SAFE JSON
// ===================================================================

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

// ===================================================================
// MULTIPART (FORMIDABLE)
// ===================================================================

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

      // Fix: formidable sometimes returns an array
      if (Array.isArray(file)) {
        file = file[0];
      }

      if (!file) {
        return reject(new Error("Missing file field"));
      }

      if (!file.filepath) {
        return reject(new Error("File has no filepath property"));
      }

      let fileBuffer = null;
      try {
        fileBuffer = fs.readFileSync(file.filepath);
      } catch (e) {
        return reject(new Error("Failed to read uploaded file"));
      }

      const filename = file.originalFilename || "";
      const mimeType = file.mimetype || "";

      resolve({ patientId, fileBuffer, filename, mimeType });
    });
  });
}

// ===================================================================
// FILE TO TEXT
// ===================================================================

async function extractTextFromBuffer(fileBuffer, filename, mimeType) {
  if (!fileBuffer || !fileBuffer.length) return "";

  const lowerName = (filename || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (lowerName.endsWith(".docx")) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      return value || "";
    } catch {
      return fileBuffer.toString("utf8");
    }
  }

  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) {
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
// FIREBASE TOKEN
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
    audience: FIREBASE_PROJECT_ID
  });

  return payload.user_id;
}

// ===================================================================
// FIRESTORE UPDATE
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
      "updateMask.fieldPaths=gender"
    ].join("&");

  const arr = (list = []) => ({
    arrayValue: {
      values: (list || []).map((x) => ({ stringValue: x }))
    }
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
                flag: { stringValue: x.flag || "" }
              }
            }
          }))
        }
      },

      medicalFileUpdatedAt: { timestampValue: new Date().toISOString() },
      maritalStatus: { stringValue: extracted.maritalStatus || "" },
      bloodType: { stringValue: extracted.bloodType || "" },

      age: {
        integerValue: extracted.age
          ? String(extracted.age).replace(/\D/g, "") || "0"
          : "0"
      },

      gender: { stringValue: extracted.gender || "" }
    }
  };

  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(txt);
  }
}

// ===================================================================
// CHUNK / MERGE
// ===================================================================

function splitChunks(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHARS_PER_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHARS_PER_CHUNK));
  }
  return chunks;
}

function clean(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
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

function merge(parts) {
  const out = makeEmpty();

  const mergeArr = (target, arr) => {
    (arr || []).forEach((v) => {
      const s = clean(v);
      if (s && !target.includes(s)) target.push(s);
    });
  };

  for (const p of parts) {
    if (!p) continue;

    mergeArr(out.allergies, p.allergies);
    mergeArr(out.conditions, p.conditions);
    mergeArr(out.medications, p.medications);

    ["diagnosis", "findings", "procedures", "notes"].forEach((k) => {
      if (p[k]) {
        const val = clean(p[k]);
        if (val) {
          out[k] = out[k] ? out[k] + "\n" + val : val;
        }
      }
    });

    if (Array.isArray(p.labResults)) {
      out.labResults.push(
        ...p.labResults.map((x) => ({
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

// ===================================================================
// NOTES BUILDER
// ===================================================================

function buildNotesFromExtract(extracted) {
  const sections = [];

  const arr = (label, list) => {
    const items = (list || []).map(clean).filter(Boolean);
    if (items.length) {
      sections.push(`${label}: ${items.join(", ")}`);
    }
  };

  arr("Allergies", extracted.allergies);
  arr("Conditions", extracted.conditions);
  arr("Medications", extracted.medications);

  if (clean(extracted.diagnosis))
    sections.push("Diagnosis: " + clean(extracted.diagnosis));
  if (clean(extracted.findings))
    sections.push("Findings: " + clean(extracted.findings));
  if (clean(extracted.procedures))
    sections.push("Procedures: " + clean(extracted.procedures));

  if (Array.isArray(extracted.labResults)) {
    const lines = extracted.labResults
      .map((x) => {
        const parts = [];
        if (clean(x.test)) parts.push("Test: " + clean(x.test));
        if (clean(x.value)) parts.push("Value: " + clean(x.value));
        if (clean(x.unit)) parts.push("Unit: " + clean(x.unit));
        if (clean(x.flag)) parts.push("Flag: " + clean(x.flag));
        if (!parts.length) return null;
        return "- " + parts.join(", ");
      })
      .filter(Boolean);

    if (lines.length) {
      sections.push("Lab Results:");
      sections.push(...lines);
    }
  }

  if (clean(extracted.notes))
    sections.push("Other notes: " + clean(extracted.notes));

  return sections.join("\n").trim();
}

// ===================================================================
// FANAR EXTRACTION
// ===================================================================

async function extractWithFanar(text) {
  const chunks = splitChunks(text);
  const results = [];

  const system = `
Extract only medical information.
Remove all personal identifiers.
Return JSON exactly matching schema:
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

    if (!resp.ok) {
      throw new Error(resp.data?.message || "Fanar error");
    }

    const raw = resp.data?.choices?.[0]?.message?.content || "";
    const json = safeExtractJson(raw);

    if (!json) {
      throw new Error("Invalid JSON from Fanar");
    }

    results.push(json);
  }

  return merge(results);
}

// ===================================================================
// MAIN HANDLER
// ===================================================================

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const token = req.headers.authorization?.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({ error: "Missing Token" });
    }

    await verifyToken(token);

    const { patientId, fileBuffer, filename, mimeType } =
      await parseMultipart(req);

    if (!patientId) {
      return res.status(400).json({ error: "Missing patientId" });
    }
    if (!fileBuffer || !fileBuffer.length) {
      return res.status(400).json({ error: "Missing file" });
    }

    const raw = await extractTextFromBuffer(fileBuffer, filename, mimeType);
    const cleanText = (raw || "").replace(/\s+/g, " ").trim();

    if (!cleanText) {
      const empty = makeEmpty();
      empty.notes = "";
      await updateFirestore(token, patientId, empty);
      return res.status(200).json({
        ok: true,
        extracted: empty,
        warning: "No text extracted"
      });
    }

    let extracted = makeEmpty();

    try {
      extracted = await extractWithFanar(cleanText);
    } catch (e) {
      extracted = makeEmpty();
    }

    extracted.notes = buildNotesFromExtract(extracted);

    await updateFirestore(token, patientId, extracted);

    return res.status(200).json({ ok: true, extracted });
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({
      ok: false,
      error: e.message || "Server Error"
    });
  }
}
