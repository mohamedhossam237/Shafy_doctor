import formidable from "formidable";
import fs from "fs";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createRemoteJWKSet, jwtVerify } from "jose";
import Tesseract from "tesseract.js";

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
  } catch { }

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
// FILE TO TEXT (WITH OCR)
// ===============================================================

async function extractTextFromBuffer(fileBuffer, filename, mimeType) {
  if (!fileBuffer || !fileBuffer.length) return "";

  const name = (filename || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  // DOCX
  if (name.endsWith(".docx")) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      return value || "";
    } catch {
      return fileBuffer.toString("utf8");
    }
  }

  // PDF
  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    try {
      const data = await pdfParse(fileBuffer);
      return data.text || "";
    } catch {
      return fileBuffer.toString("utf8");
    }
  }

  // IMAGES (OCR)
  if (mime.startsWith("image/") || name.match(/\.(jpg|jpeg|png|bmp|webp)$/)) {
    try {
      console.log("Starting OCR for image:", name);
      const { data: { text } } = await Tesseract.recognize(fileBuffer, "eng+ara");
      console.log("OCR Completed. Text length:", text.length);
      return text || "";
    } catch (e) {
      console.error("OCR Failed:", e);
      return "";
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
    clinicalSummary: "",
    labResults: [],
    age: "",
    gender: "",
    maritalStatus: "",
    bloodType: "",
    // New fields
    weight: "",
    height: "",
    bloodPressure: "",
    temperature: "",
    phone: "",
    email: "",
    address: "",
    isSmoker: false,
    drinksAlcohol: false
  };
}

// ===============================================================
// FANAR EXTRACTION
// ===============================================================

async function extractWithFanar(text) {
  const chunks = splitChunks(text);
  const results = [];

  const system = `
You are an expert Medical Scribe and Data Extractor.
Your goal is to ensure 100% of the document's content is captured.

STEP 1: THE CLINICAL NARRATIVE (CRITICAL)
First, write a comprehensive "clinical_summary" that reads like a professional doctor's note.
- This summary MUST include EVERYTHING from the document: history, exam findings, lab results, medications, dates, and doctor's recommendations.
- Do not leave ANYTHING out. If it's in the document, it must be in this summary.
- Use professional medical phrasing.
- Mention "Impossible" values (e.g. "Temp 84") in this summary as "Recorded values".

STEP 2: STRUCTURED EXTRACTION
After writing the summary, extract specific data points into the JSON fields.

VALIDATION RULES:
- Valid data → Specific Field
- Invalid/Impossible data → Do NOT put in specific field, but ENSURE it is in the "clinical_summary".

JSON STRUCTURE:
{
  "clinical_summary": "Full narrative text covering the ENTIRE document...",
  "age": "...",
  "gender": "...",
  "medications": ["Med Name 1", "Med Name 2"],
  "allergies": [],
  "conditions": [],
  "diagnosis": "...",
  "findings": "...",
  "labResults": [],
  "weight": "...",
  "height": "...",
  "bloodPressure": "...",
  "temperature": "...",
  "phone": "...",
  "email": "...",
  "address": "...",
  "maritalStatus": "...",
  "bloodType": "..."
}
`;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}, length: ${chunks[i].length}`);

    const resp = await fanarChat([
      { role: "system", content: system },
      { role: "user", content: chunks[i] }
    ]);

    if (!resp.ok) {
      console.error(`Fanar API error for chunk ${i + 1}:`, resp.status, resp.data);
      throw new Error("Fanar API error");
    }

    const raw = resp.data?.choices?.[0]?.message?.content || "";
    console.log(`AI Response for chunk ${i + 1}:`, raw.substring(0, 200) + '...');

    const json = safeExtractJson(raw);
    if (!json) {
      console.error(`Invalid JSON from chunk ${i + 1}. Raw response:`, raw);
      throw new Error("Invalid JSON");
    }

    console.log(`Extracted from chunk ${i + 1}:`, JSON.stringify(json, null, 2).substring(0, 500));
    results.push(json);
  }

  const merged = mergeExtract(results);
  console.log('Final merged extraction:', JSON.stringify(merged, null, 2).substring(0, 1000));
  return merged;
}

// ===============================================================
// AI VALIDATION & CLEANING (for fallback results)
// ===============================================================

async function validateAndCleanWithAI(rawData, originalText) {
  const system = `
You are a medical data validator. You receive raw extracted data that may contain errors, duplicates, or non-medical information.

Your task:
1. VALIDATE all medical data is logically correct
2. CLEAN and standardize the data
3. Move any non-medical or unstructured info to "notes"
4. Ensure medications are ONLY real drug/medication names
5. Remove any duplicate or invalid entries
6. Verify all values make medical sense
7. Properly categorize data - lab results are NOT medications

CRITICAL CATEGORIZATION RULES:
- Medications: ONLY actual drug names (e.g., "Lezberg amlo 20/5", "Aspirin 100mg")
- Lab Results: LDL, BG, creat, UA, etc. → put in "labResults" or "findings"
- Examination findings: LL edema, Scattred rhonchi, etc. → put in "findings"
- Diagnoses: → put in "diagnosis"
- Clinical notes with dates: → put in "notes"
- If uncertain whether something is a medication, check if it's a drug name or medical finding

VALIDATION RULES:
- Temperature: 35-42°C only
- Blood Pressure: Systolic 60-250, Diastolic 40-150
- Weight: 2-300 kg
- Height: 30-250 cm
- Age: 0-120 years
- Medications: Must be valid drug/brand names, include dosage if available
- Remove any headers, labels, or non-data text from arrays

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
  "bloodType": "",
  "weight": "",
  "height": "",
  "bloodPressure": "",
  "temperature": "",
  "phone": "",
  "email": "",
  "address": "",
  "isSmoker": false,
  "drinksAlcohol": false
}

IMPORTANT:
- If a field has invalid data, set it to empty/[] rather than keeping bad data
- Put any text that doesn't fit structured fields into "notes"
- For medications: keep ONLY the drug name and dosage, remove table formatting or empty entries
- Ensure arrays contain ONLY valid medical terms, not table headers or separators
`;

  const userPrompt = `
Raw extracted data:
${JSON.stringify(rawData, null, 2)}

Original text snippet (for context):
${originalText.substring(0, 1000)}

Please validate, clean, and structure this data properly. Remove invalid entries and move unstructured info to notes.
`;

  try {
    const resp = await fanarChat([
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ]);

    if (!resp.ok) throw new Error("Fanar API validation error");

    const raw = resp.data?.choices?.[0]?.message?.content || "";
    const json = safeExtractJson(raw);
    if (!json) throw new Error("Invalid JSON from validation");

    return json;
  } catch (e) {
    console.error("AI validation failed:", e.message);
    // If validation fails, return the original data
    return rawData;
  }
}

// ===============================================================
// NORMALIZE & MAP COMMON VARIATIONS
// ===============================================================

function normalizeExtractedData(data) {
  const normalized = { ...data };

  // Gender normalization
  if (normalized.gender) {
    const g = normalized.gender.toLowerCase();
    if (g.includes('male') || g.includes('ذكر') || g === 'm') {
      normalized.gender = 'Male';
    } else if (g.includes('female') || g.includes('أنثى') || g === 'f') {
      normalized.gender = 'Female';
    }
  }

  // Blood Type normalization (ensure format is consistent)
  if (normalized.bloodType) {
    normalized.bloodType = normalized.bloodType.toUpperCase().replace(/\s/g, '');
  }

  // Marital Status normalization
  if (normalized.maritalStatus) {
    const m = normalized.maritalStatus.toLowerCase();
    if (m.includes('single') || m.includes('أعزب') || m.includes('عزباء')) {
      normalized.maritalStatus = 'Single';
    } else if (m.includes('married') || m.includes('متزوج')) {
      normalized.maritalStatus = 'Married';
    } else if (m.includes('divorced') || m.includes('مطلق')) {
      normalized.maritalStatus = 'Divorced';
    } else if (m.includes('widow') || m.includes('أرمل')) {
      normalized.maritalStatus = 'Widowed';
    }
  }

  // Smoking & Alcohol (look for positive indicators)
  if (typeof normalized.isSmoker === 'string') {
    const s = normalized.isSmoker.toLowerCase();
    normalized.isSmoker = s.includes('yes') || s.includes('true') || s.includes('نعم') || s.includes('smoker');
  }
  if (typeof normalized.drinksAlcohol === 'string') {
    const a = normalized.drinksAlcohol.toLowerCase();
    normalized.drinksAlcohol = a.includes('yes') || a.includes('true') || a.includes('نعم') || a.includes('drink');
  }

  return normalized;
}

// ===============================================================
// VALIDATE MEDICAL DATA (REJECT IMPOSSIBLE VALUES)
// ===============================================================

function validateMedicalData(data) {
  const validated = { ...data };
  const notesToAdd = [];

  // Helper to reject and note
  const reject = (field, value, reason) => {
    console.log(`Invalid ${field}: ${value} - moving to notes`);
    notesToAdd.push(`${field} value "${value}" rejected: ${reason}`);
    validated[field] = '';
  };

  // Temperature validation (normal human range: 35-42°C)
  if (validated.temperature) {
    const tempStr = String(validated.temperature).replace(/[^0-9.]/g, '');
    const temp = parseFloat(tempStr);
    if (!isNaN(temp)) {
      if (temp < 35 || temp > 42) {
        reject('Temperature', validated.temperature, 'Outside human range (35-42°C)');
      } else {
        validated.temperature = temp + '°C';
      }
    }
  }

  // Blood Pressure validation (systolic: 60-250, diastolic: 40-150)
  if (validated.bloodPressure) {
    const bpMatch = String(validated.bloodPressure).match(/(\d+)\s*\/\s*(\d+)/);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1]);
      const diastolic = parseInt(bpMatch[2]);
      if (systolic < 60 || systolic > 250 || diastolic < 40 || diastolic > 150) {
        reject('Blood Pressure', validated.bloodPressure, 'Outside valid range');
      } else {
        validated.bloodPressure = `${systolic}/${diastolic}`;
      }
    }
  }

  // Weight validation (reasonable range: 2-300 kg)
  if (validated.weight) {
    const weightStr = String(validated.weight).replace(/[^0-9.]/g, '');
    const weight = parseFloat(weightStr);
    if (!isNaN(weight)) {
      if (weight < 2 || weight > 300) {
        reject('Weight', validated.weight, 'Outside valid range (2-300kg)');
      } else {
        validated.weight = weight + ' kg';
      }
    }
  }

  // Height validation (reasonable range: 30-250 cm)
  if (validated.height) {
    const heightStr = String(validated.height).replace(/[^0-9.]/g, '');
    const height = parseFloat(heightStr);
    if (!isNaN(height)) {
      if (height < 30 || height > 250) {
        reject('Height', validated.height, 'Outside valid range (30-250cm)');
      } else {
        validated.height = height + ' cm';
      }
    }
  }

  // Age validation (reasonable range: 0-120 years)
  if (validated.age) {
    const age = parseInt(String(validated.age).replace(/\D/g, ''));
    if (!isNaN(age)) {
      if (age < 0 || age > 120) {
        reject('Age', validated.age, 'Outside valid range (0-120)');
      } else {
        validated.age = String(age);
      }
    }
  }

  if (notesToAdd.length > 0) {
    validated.notes = (validated.notes ? validated.notes + "\n" : "") +
      "--- Validation Notes ---\n" + notesToAdd.join("\n");
  }

  return validated;
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

    if (p.clinical_summary) {
      const val = clean(p.clinical_summary);
      if (val) {
        out.clinicalSummary = out.clinicalSummary ? out.clinicalSummary + "\n" + val : val;
      }
    }

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

    // New fields
    if (!out.weight && p.weight) out.weight = clean(p.weight);
    if (!out.height && p.height) out.height = clean(p.height);
    if (!out.bloodPressure && p.bloodPressure) out.bloodPressure = clean(p.bloodPressure);
    if (!out.temperature && p.temperature) out.temperature = clean(p.temperature);

    if (!out.phone && p.phone) out.phone = clean(p.phone);
    if (!out.email && p.email) out.email = clean(p.email);
    if (!out.address && p.address) out.address = clean(p.address);

    if (p.isSmoker) out.isSmoker = true;
    if (p.drinksAlcohol) out.drinksAlcohol = true;
  }

  return out;
}

// ===============================================================
// BUILD NOTES
// ===============================================================

function buildNotes(extracted) {
  const parts = [];

  if (clean(extracted.clinicalSummary)) {
    parts.push("CLINICAL SUMMARY:\n" + clean(extracted.clinicalSummary));
    parts.push("-------------------");
  }

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

function fallbackExtraction(text) {
  const data = makeEmpty();

  // Age patterns
  const ageMatch = text.match(/(?:age|عمر|سن)[:\s]*(\d+)/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age >= 0 && age <= 120) data.age = String(age);
  }

  // Gender patterns
  const genderMatch = text.match(/(?:gender|sex|جنس|نوع)[:\s]*(male|female|ذكر|أنثى|m|f)/i);
  if (genderMatch) data.gender = genderMatch[1];

  // Weight patterns
  const weightMatch = text.match(/(?:weight|wt|وزن|الوزن)[:\s]*(\d+(?:\.\d+)?)\s*(?:kg|كجم)?/i);
  if (weightMatch) {
    data.weight = weightMatch[1] + ' kg';
  }

  // Height patterns
  const heightMatch = text.match(/(?:height|ht|طول|الطول)[:\s]*(\d+(?:\.\d+)?)\s*(?:cm|سم)?/i);
  if (heightMatch) {
    data.height = heightMatch[1] + ' cm';
  }

  // BP patterns
  const bpMatch = text.match(/(?:bp|pressure|ضغط)[:\s]*(\d{2,3}\s*\/\s*\d{2,3})/i);
  if (bpMatch) data.bloodPressure = bpMatch[1].replace(/\s+/g, '');

  // Temp patterns
  const tempMatch = text.match(/(?:temp|temperature|حرارة)[:\s]*(\d+(?:\.\d+)?)/i);
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1]);
    // Only accept if in valid human range
    if (temp >= 35 && temp <= 42) {
      data.temperature = temp + '°C';
    }
    // Otherwise reject - might be Fahrenheit or error
  }

  // Phone patterns
  const phoneMatch = text.match(/(?:phone|tel|mobile|هاتف|تليفون|رقم)[:\s]*([\d\s\-+()]{10,})/i);
  if (phoneMatch) data.phone = phoneMatch[1].trim();

  // Email patterns
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  if (emailMatch) data.email = emailMatch[1];

  return data;
}

// ===============================================================
// MAIN HANDLER
// ===============================================================

export default async function handler(req, res) {
  console.log("Medical File Intake API called");
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1. Check API Key
    try {
      getFanarKey();
    } catch (e) {
      console.error("Configuration Error:", e.message);
      return res.status(500).json({ error: "Server configuration error: Missing AI Key" });
    }

    // 2. Verify Token
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    try {
      await verifyToken(token);
    } catch (e) {
      console.error("Token verification failed:", e.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // 3. Parse File
    let parseResult;
    try {
      parseResult = await parseMultipart(req);
    } catch (e) {
      console.error("Multipart parse failed:", e.message);
      return res.status(400).json({ error: "File upload failed: " + e.message });
    }

    const { patientId, fileBuffer, filename, mimeType } = parseResult;

    if (!patientId) {
      return res.status(400).json({ error: "Missing patientId" });
    }

    // 4. Extract Text
    let raw = "";
    try {
      raw = await extractTextFromBuffer(fileBuffer, filename, mimeType);
    } catch (e) {
      console.error("Text extraction failed:", e.message);
      return res.status(400).json({ error: "Failed to read file text: " + e.message });
    }

    const cleanText = (raw || "").replace(/\s+/g, " ").trim();
    console.log("Extracted text length:", cleanText.length);

    if (!cleanText) {
      const emptyData = makeEmpty();
      return res.status(200).json({
        ok: true,
        extracted: emptyData,
        warning: "No text extracted from file"
      });
    }

    // 5. AI Extraction
    let extracted = makeEmpty();
    let usedFallback = false;

    console.log("Starting AI extraction...");
    try {
      extracted = await extractWithFanar(cleanText);
      console.log("AI extraction successful!");
    } catch (e) {
      console.error("AI Extraction failed:", e.message);
      console.log("Falling back to regex extraction...");
      // Fallback: try basic regex extraction
      extracted = fallbackExtraction(cleanText);
      usedFallback = true;
      console.log("Fallback extraction completed:", JSON.stringify(extracted, null, 2).substring(0, 500));
    }

    // If we used fallback, validate and clean with AI
    if (usedFallback) {
      console.log("Using AI to validate and clean fallback results...");
      try {
        extracted = await validateAndCleanWithAI(extracted, cleanText);
        console.log("AI validation successful!");
      } catch (e) {
        console.error("AI validation failed, using fallback data as-is:", e.message);
      }
    }

    // Normalize the extracted data
    extracted = normalizeExtractedData(extracted);

    // Validate medical values (reject impossible values)
    extracted = validateMedicalData(extracted);

    extracted.notes = buildNotes(extracted);

    return res.status(200).json({
      ok: true,
      extracted
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error: " + (e.message || String(e))
    });
  }
}
