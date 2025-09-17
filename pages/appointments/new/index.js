// /pages/appointments/new.js
"use client";

import * as React from "react";
import { useRouter } from "next/router";
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  TextField,
  Button,
  Snackbar,
  Alert,
  Autocomplete,
  CircularProgress,
  Divider,
  MenuItem,
} from "@mui/material";

import Protected from "@/components/Protected";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/providers/AuthProvider";

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

/* ---------------- helpers to mirror patient flow ---------------- */

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function weekdayKey(date) {
  // Sun=0 ... Sat=6
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
}

function minutes(hhmm) {
  const [h = 0, m = 0] = String(hhmm || "")
    .split(":")
    .map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

function parseDayRanges(val) {
  // Accepts "09:00-12:00, 13:00-17:00" or array of "HH:MM-HH:MM"
  if (!val) return [];
  const arr = Array.isArray(val) ? val : String(val).split(",");
  const toMin = (s) => {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    return (isFinite(h) ? h : 0) * 60 + (isFinite(m) ? m : 0);
  };
  const out = [];
  for (const raw of arr) {
    const [a, b] = String(raw).trim().split("-");
    if (a && b) out.push([toMin(a.trim()), toMin(b.trim())]);
  }
  return out;
}

function buildSlotsForRanges(ranges, stepMin = 30) {
  const slots = [];
  for (const [start, end] of ranges) {
    for (let t = start; t + stepMin <= end; t += stepMin) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      slots.push(`${pad(hh)}:${pad(mm)}`);
    }
  }
  return slots;
}

// Convert EditHoursDialog shape {open, start, end} -> "start-end" string (or empty)
function toRangeStringFromHoursDay(dayObj) {
  if (!dayObj || dayObj.open !== true) return "";
  const start = dayObj.start || "09:00";
  const end = dayObj.end || "17:00";
  return `${start}-${end}`;
}

// Try to normalize whatever the doc has into { sun..sat: "HH:MM-HH:MM[, ...]" }
function normalizeHoursFromAny(sourceObj) {
  if (!sourceObj || typeof sourceObj !== "object") {
    return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
  }
  // 1) if a direct working_hours/workingHours object exists (strings or EditHoursDialog shape)
  const src =
    sourceObj.working_hours ||
    sourceObj.workingHours ||
    (sourceObj.clinic && (sourceObj.clinic.working_hours || sourceObj.clinic.workingHours)) ||
    null;

  if (src && typeof src === "object" && typeof src.sun === "string") return src;

  if (src && typeof src === "object" && typeof src.sun === "object") {
    const out = {};
    for (const k of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
      out[k] = toRangeStringFromHoursDay(src[k]);
    }
    return out;
  }

  // Fallback: no hours configured
  return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
}

const sanitizeClinics = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id || c._id || `c_${Math.random().toString(36).slice(2, 8)}`,
      name_en: String(c.name_en || c.name || "").trim(),
      name_ar: String(c.name_ar || c.name || "").trim(),
      address_en: String(c.address_en || c.address || "").trim(),
      address_ar: String(c.address_ar || c.address || "").trim(),
      // hours containers (support both spellings)
      working_hours: c.working_hours || c.workingHours || null,
      active: c.active !== false,
    }));

/* ---------------- page ---------------- */

export default function NewAppointmentPage() {
  const router = useRouter();
  const { user } = useAuth(); // doctor account

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith("ar");
    if (q.ar) return q.ar === "1" || String(q.ar).toLowerCase() === "true";
    return false;
  }, [router?.query]);

  /* patients */
  const [loadingPatients, setLoadingPatients] = React.useState(true);
  const [patients, setPatients] = React.useState([]);
  const [selectedPatient, setSelectedPatient] = React.useState(null);

  /* doctor, clinics & hours */
  const [doctor, setDoctor] = React.useState(null);
  const [clinics, setClinics] = React.useState([]);            // NEW
  const [selectedClinicId, setSelectedClinicId] = React.useState(""); // NEW
  const [hours, setHours] = React.useState(null); // normalized strings per day
  const [loadingDoctor, setLoadingDoctor] = React.useState(true);

  /* form */
  const [dateStr, setDateStr] = React.useState(toYMD(new Date())); // YYYY-MM-DD
  const [timeStr, setTimeStr] = React.useState("");
  const [note, setNote] = React.useState("");

  /* slots */
  const [allSlots, setAllSlots] = React.useState([]);
  const [bookedSet, setBookedSet] = React.useState(new Set());
  const availableSlots = React.useMemo(
    () => allSlots.filter((s) => !bookedSet.has(s)),
    [allSlots, bookedSet]
  );

  /* ui */
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  /* Load patients of this doctor */
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoadingPatients(true);
      setError("");
      try {
        const qRef = query(
          collection(db, "patients"),
          where("registeredBy", "==", user.uid)
        );
        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) =>
          String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, {
            sensitivity: "base",
          })
        );
        setPatients(rows);
      } catch (e) {
        console.error(e);
        setError(
          isArabic ? "حدث خطأ أثناء تحميل المرضى" : "Failed to load patients"
        );
      } finally {
        setLoadingPatients(false);
      }
    })();
  }, [user?.uid, isArabic]);

  /* Load doctor doc + clinics; pick hours from selected clinic (fallback to doctor) */
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoadingDoctor(true);
      try {
        const snap = await getDoc(doc(db, "doctors", String(user.uid)));
        if (!snap.exists()) {
          setDoctor(null);
          setClinics([]);
          setSelectedClinicId("");
          setHours(normalizeHoursFromAny(null));
        } else {
          const d = { id: snap.id, ...snap.data() };
          setDoctor(d);

          const cls = sanitizeClinics(d.clinics);
          setClinics(cls);

          // default select: if 1 clinic, select it; else none (force user to choose)
          if (cls.length === 1) {
            setSelectedClinicId(cls[0].id);
            setHours(normalizeHoursFromAny(cls[0]));
          } else {
            // no clinic or multi → use doctor's global hours until user picks one
            setHours(normalizeHoursFromAny(d));
          }
        }
      } catch (e) {
        console.error(e);
        setDoctor(null);
        setClinics([]);
        setSelectedClinicId("");
        setHours(normalizeHoursFromAny(null));
      } finally {
        setLoadingDoctor(false);
      }
    })();
  }, [user?.uid]);

  // When clinic selection changes, recompute hours (clinic hours → fallback to doctor)
  React.useEffect(() => {
    if (!doctor) return;
    if (selectedClinicId) {
      const c = clinics.find((x) => x.id === selectedClinicId);
      setHours(normalizeHoursFromAny(c || {}));
    } else {
      setHours(normalizeHoursFromAny(doctor));
    }
    // reset chosen time on clinic switch
    setTimeStr("");
  }, [selectedClinicId, clinics, doctor]);

  /* recompute slots when date / hours / clinic change, and fetch booked for that day (per clinic) */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hours || !dateStr) {
          setAllSlots([]);
          setBookedSet(new Set());
          return;
        }

        const d = new Date(dateStr + "T00:00:00");
        const k = weekdayKey(d);

        // Build slots from hours (string ranges) in 30-min steps
        const ranges = parseDayRanges(hours[k]);
        let slots = buildSlotsForRanges(ranges, 30);

        // If selected date is today, filter out past times
        const now = new Date();
        if (toYMD(now) === dateStr) {
          const nowMin = now.getHours() * 60 + now.getMinutes();
          slots = slots.filter((s) => minutes(s) > nowMin);
        }

        if (!cancelled) setAllSlots(slots);

        // Fetch existing appointments for this doctor & day, then restrict to same clinic (if selected)
        if (!user?.uid) return;
        const col = collection(db, "appointments");
        const [snapId, snapUID] = await Promise.all([
          getDocs(query(col, where("doctorId", "==", String(user.uid)), where("date", "==", dateStr))),
          getDocs(query(col, where("doctorUID", "==", String(user.uid)), where("date", "==", dateStr))),
        ]);

        // Combine & filter by clinic if selected
        const appts = [...snapId.docs, ...snapUID.docs].map((d) => ({ id: d.id, ...d.data() }));
        const sameClinic = selectedClinicId
          ? appts.filter((a) => (a.clinicId || a.clinicID || "") === selectedClinicId)
          : appts;

        const used = new Set();
        for (const r of sameClinic) {
          const tm = (r.time || "").trim();
          if (tm) used.add(tm);
        }
        if (!cancelled) setBookedSet(used);

        // Nudge invalid current selection
        if (timeStr && (!slots.includes(timeStr) || used.has(timeStr))) {
          setTimeStr("");
        }
      } catch (e) {
        if (!cancelled) {
          setAllSlots([]);
          setBookedSet(new Set());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hours, dateStr, user?.uid, timeStr, selectedClinicId]);

  // Queue number: 1 + count of already-booked (<= new time) **within same clinic**
  function computeQueueNumberForNew(time, existingTimesSet) {
    const newMin = minutes(time);
    let count = 0;
    for (const t of existingTimesSet) {
      const m = minutes(t);
      if (m <= newMin) count += 1;
    }
    return count + 1;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user?.uid) return;

    // If the doctor has multiple clinics, require picking one
    if (clinics.length > 1 && !selectedClinicId) {
      setError(isArabic ? "اختر العيادة أولاً" : "Please choose a clinic first");
      return;
    }

    if (!selectedPatient) {
      setError(isArabic ? "الرجاء اختيار مريض" : "Please select a patient");
      return;
    }
    if (!dateStr || !timeStr) {
      setError(
        isArabic ? "اختر التاريخ والوقت" : "Please choose date & time"
      );
      return;
    }

    // Ensure chosen time is still available
    if (!availableSlots.includes(timeStr)) {
      setError(
        isArabic
          ? "الوقت المختار لم يعد متاحاً"
          : "Selected time is no longer available"
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMsg("");

      // Compute queueNumber (per clinic)
      const queueNumber = computeQueueNumberForNew(timeStr, bookedSet);

      // Doctor fields
      const docNameEn = doctor?.name_en || "";
      const docNameAr = doctor?.name_ar || "";
      const specEn = doctor?.specialty_en || doctor?.specialty || "";
      const specAr = doctor?.specialty_ar || "";
      const price = doctor?.checkupPrice ?? null;

      // Clinic labels
      const clinic = selectedClinicId ? clinics.find((c) => c.id === selectedClinicId) : null;
      const clinicName_en = clinic?.name_en || "";
      const clinicName_ar = clinic?.name_ar || "";

      // Persist
      await addDoc(collection(db, "appointments"), {
        doctorId: String(user.uid),
        doctorUID: String(user.uid),  // keep for backward-compat
        doctorName_en: docNameEn,
        doctorName_ar: docNameAr,
        doctorSpecialty_en: specEn,
        doctorSpecialty_ar: specAr,
        doctorPrice: price,

        // per-clinic association
        clinicId: selectedClinicId || "",
        clinicName_en,
        clinicName_ar,

        date: dateStr,   // "YYYY-MM-DD"
        time: timeStr,   // "HH:MM"
        // appointmentDate: new Date(`${dateStr}T${timeStr}:00`), // optional

        patientUid: selectedPatient.id,
        patientName: selectedPatient.name || "",
        patientPhone: selectedPatient.phone || selectedPatient.phoneNumber || "",
        patientEmail: selectedPatient.email || "",

        note: note.trim(),
        aiBrief: "",

        status: "confirmed", // doctor-created defaults to confirmed
        queueNumber,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMsg(
        isArabic
          ? `تم إنشاء الموعد. رقم الدور: ${queueNumber}.`
          : `Appointment created. Queue number: ${queueNumber}.`
      );

      // Clear time & note (keep patient/clinic selection for faster entry)
      setTimeStr("");
      setNote("");
    } catch (e) {
      console.error(e);
      setError(
        e?.message ||
          (isArabic ? "فشل في إنشاء الموعد" : "Failed to create appointment")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const backHref = `/appointments${isArabic ? "?lang=ar" : ""}`;

  // UI helpers
  const clinicHelper =
    clinics.length <= 1
      ? isArabic
        ? "ساعات العمل من الإعدادات العامة للطبيب"
        : "Using doctor's global working hours"
      : isArabic
      ? "اختر العيادة لتطبيق مواعيد عملها"
      : "Choose a clinic to apply its working hours";

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="sm">
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <Typography variant="h5" fontWeight={700}>
                {isArabic ? "إنشاء موعد جديد" : "Create New Appointment"}
              </Typography>
              <Button variant="text" onClick={() => router.push(backHref)}>
                {isArabic ? "العودة للمواعيد" : "Back to Appointments"}
              </Button>
            </Stack>

            <Paper sx={{ p: 2.5, borderRadius: 2 }}>
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  {/* Patient selector */}
                  <Autocomplete
                    options={patients}
                    loading={loadingPatients}
                    getOptionLabel={(o) => String(o?.name ?? o?.id ?? "")}
                    isOptionEqualToValue={(a, b) => a?.id === b?.id}
                    value={selectedPatient}
                    onChange={(_, v) => setSelectedPatient(v)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={isArabic ? "المريض" : "Patient"}
                        placeholder={isArabic ? "ابحث عن مريض..." : "Search patient..."}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingPatients ? <CircularProgress color="inherit" size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  {/* Clinic selector (if multiple) */}
                  {clinics.length > 1 && (
                    <TextField
                      select
                      label={isArabic ? "العيادة" : "Clinic"}
                      value={selectedClinicId}
                      onChange={(e) => setSelectedClinicId(e.target.value)}
                      helperText={clinicHelper}
                    >
                      <MenuItem value="">{isArabic ? "— اختر —" : "— Select —"}</MenuItem>
                      {clinics.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {isArabic ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  {/* Date */}
                  <TextField
                    label={isArabic ? "التاريخ" : "Date"}
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: toYMD(new Date()) }}
                  />

                  {/* Time (from working hours + availability — per clinic) */}
                  <TextField
                    select
                    label={isArabic ? "الوقت" : "Time"}
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    helperText={
                      loadingDoctor
                        ? isArabic
                          ? "جاري تحميل مواعيد العمل…"
                          : "Loading clinic hours…"
                        : availableSlots.length
                        ? isArabic
                          ? "الأوقات المتاحة لهذا اليوم"
                          : "Available for this date"
                        : isArabic
                        ? "لا توجد أوقات متاحة لهذا اليوم"
                        : "No available times for this date"
                    }
                  >
                    {availableSlots.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>

                  {/* Notes */}
                  <TextField
                    label={isArabic ? "ملاحظات (اختياري)" : "Notes (optional)"}
                    multiline
                    minRows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  <Divider />

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                    <Button type="button" variant="text" onClick={() => router.push(backHref)}>
                      {isArabic ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={
                        submitting ||
                        loadingPatients ||
                        loadingDoctor ||
                        !selectedPatient ||
                        (clinics.length > 1 && !selectedClinicId)
                      }
                    >
                      {submitting
                        ? isArabic
                          ? "جاري الحجز..."
                          : "Booking..."
                        : isArabic
                        ? "تأكيد الحجز"
                        : "Book Appointment"}
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </Paper>
          </Stack>

          {/* Errors */}
          <Snackbar
            open={Boolean(error)}
            autoHideDuration={4000}
            onClose={() => setError("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          </Snackbar>

          {/* Success */}
          <Snackbar
            open={Boolean(successMsg)}
            autoHideDuration={3500}
            onClose={() => setSuccessMsg("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert severity="success" onClose={() => setSuccessMsg("")}>
              {successMsg}
            </Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
