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

// Try to normalize whatever the doctor doc has into { sun..sat: "HH:MM-HH:MM[, ...]" }
function normalizeDoctorHours(doctorDoc) {
  const src =
    doctorDoc?.working_hours ||
    doctorDoc?.workingHours ||
    doctorDoc?.clinic?.working_hours ||
    doctorDoc?.clinic?.workingHours ||
    null;

  // If already strings/range arrays keyed by day, keep as-is
  if (src && typeof src === "object" && src.sun && typeof src.sun === "string")
    return src;

  // If EditHoursDialog shape
  if (src && typeof src === "object" && src.sun && typeof src.sun === "object") {
    const out = {};
    for (const k of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
      out[k] = toRangeStringFromHoursDay(src[k]);
    }
    return out;
  }

  // Fallback: no hours configured
  return {
    sun: "",
    mon: "",
    tue: "",
    wed: "",
    thu: "",
    fri: "",
    sat: "",
  };
}

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

  /* doctor & hours */
  const [doctor, setDoctor] = React.useState(null);
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
        const q = query(
          collection(db, "patients"),
          where("registeredBy", "==", user.uid)
        );
        const snap = await getDocs(q);
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

  /* Load doctor doc + normalize hours */
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoadingDoctor(true);
      try {
        const snap = await getDoc(doc(db, "doctors", String(user.uid)));
        if (snap.exists()) {
          const d = { id: snap.id, ...snap.data() };
          setDoctor(d);
          setHours(normalizeDoctorHours(d));
        } else {
          setDoctor(null);
          setHours(normalizeDoctorHours(null));
        }
      } catch (e) {
        console.error(e);
        setDoctor(null);
        setHours(normalizeDoctorHours(null));
      } finally {
        setLoadingDoctor(false);
      }
    })();
  }, [user?.uid]);

  /* recompute slots when date / hours change, and fetch booked for that day */
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

        // Fetch existing appointments (support doctorId and doctorUID)
        if (!user?.uid) return;
        const col = collection(db, "appointments");
        const [snapId, snapUID] = await Promise.all([
          getDocs(query(col, where("doctorId", "==", String(user.uid)), where("date", "==", dateStr))),
          getDocs(query(col, where("doctorUID", "==", String(user.uid)), where("date", "==", dateStr))),
        ]);

        const used = new Set();
        for (const d of [...snapId.docs, ...snapUID.docs]) {
          const tm = (d.data()?.time || "").trim();
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
  }, [hours, dateStr, user?.uid, timeStr]);

  // Queue number: 1 + count of already-booked with time <= new time
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

      // Compute queueNumber
      const queueNumber = computeQueueNumberForNew(timeStr, bookedSet);

      // Doctor fields (align with patient flow)
      const docNameEn = doctor?.name_en || "";
      const docNameAr = doctor?.name_ar || "";
      const specEn = doctor?.specialty_en || doctor?.specialty || "";
      const specAr = doctor?.specialty_ar || "";
      const price = doctor?.checkupPrice ?? null;

      // Persist
      await addDoc(collection(db, "appointments"), {
        doctorId: String(user.uid),     // same as patient flow (doctor doc id)
        doctorUID: String(user.uid),    // keep for backward-compat
        doctorName_en: docNameEn,
        doctorName_ar: docNameAr,
        doctorSpecialty_en: specEn,
        doctorSpecialty_ar: specAr,
        doctorPrice: price,

        date: dateStr,                  // "YYYY-MM-DD"
        time: timeStr,                  // "HH:MM"

        // also store a combined Date for old views if you want:
        // appointmentDate: new Date(`${dateStr}T${timeStr}:00`),

        patientUid: selectedPatient.id,
        patientName: selectedPatient.name || "",
        patientPhone: selectedPatient.phone || selectedPatient.phoneNumber || "",
        patientEmail: selectedPatient.email || "",

        note: note.trim(),
        aiBrief: "",

        status: "confirmed",            // doctor-created defaults to confirmed
        queueNumber,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMsg(
        isArabic
          ? `تم إنشاء الموعد. رقم الدور: ${queueNumber}.`
          : `Appointment created. Queue number: ${queueNumber}.`
      );

      // Clear form (keep patient chosen if you prefer)
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
                        placeholder={
                          isArabic ? "ابحث عن مريض..." : "Search patient..."
                        }
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingPatients ? (
                                <CircularProgress color="inherit" size={18} />
                              ) : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  {/* Date */}
                  <TextField
                    label={isArabic ? "التاريخ" : "Date"}
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: toYMD(new Date()) }}
                  />

                  {/* Time (from working hours + availability) */}
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
                        !selectedPatient
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
