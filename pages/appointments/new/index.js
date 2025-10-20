// /pages/appointments/new.js — optimized (no useLang / no assistant guard)
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

/* ---------------- helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekdayKey = (date) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
const minutes = (hhmm) => {
  const [h = 0, m = 0] = String(hhmm || "")
    .split(":")
    .map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};
const parseDayRanges = (val) => {
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
};
const buildSlotsForRanges = (ranges, stepMin = 30) => {
  const slots = [];
  for (const [start, end] of ranges) {
    for (let t = start; t + stepMin <= end; t += stepMin) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      slots.push(`${pad(hh)}:${pad(mm)}`);
    }
  }
  return slots;
};
const toRangeStringFromHoursDay = (dayObj) => {
  if (!dayObj || dayObj.open !== true) return "";
  const start = dayObj.start || "09:00";
  const end = dayObj.end || "17:00";
  return `${start}-${end}`;
};
const normalizeHoursFromAny = (sourceObj) => {
  if (!sourceObj || typeof sourceObj !== "object") {
    return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
  }
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
  return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
};
const sanitizeClinics = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id || c._id || `c_${Math.random().toString(36).slice(2, 8)}`,
      name_en: String(c.name_en || c.name || "").trim(),
      name_ar: String(c.name_ar || c.name || "").trim(),
      address_en: String(c.address_en || c.address || "").trim(),
      address_ar: String(c.address_ar || c.address || "").trim(),
      working_hours: c.working_hours || c.workingHours || null,
      active: c.active !== false,
    }));

/* ---------------- page ---------------- */
export default function NewAppointmentPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith("ar");
    if (q.ar) return q.ar === "1" || String(q.ar).toLowerCase() === "true";
    return false;
  }, [router?.query]);

  /* patients */
  const [loadingPatients, setLoadingPatients] = React.useState(false);
  const [patients, setPatients] = React.useState([]);
  const [selectedPatient, setSelectedPatient] = React.useState(null);
  const [patientsOpened, setPatientsOpened] = React.useState(false); // lazy load boost

  /* doctor, clinics & hours */
  const [doctor, setDoctor] = React.useState(null);
  const [clinics, setClinics] = React.useState([]);
  const [selectedClinicId, setSelectedClinicId] = React.useState("");
  const [hours, setHours] = React.useState(null);
  const [loadingDoctor, setLoadingDoctor] = React.useState(true);

  /* form */
  const [dateStr, setDateStr] = React.useState(toYMD(new Date()));
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

  // ---- FAST PATH: load doctor first; lazy-load patients on demand ----
  React.useEffect(() => {
    if (!user?.uid) return;
    let cancel = false;
    (async () => {
      setLoadingDoctor(true);
      try {
        const snap = await getDoc(doc(db, "doctors", String(user.uid)));
        if (!snap.exists()) {
          if (!cancel) {
            setDoctor(null);
            setClinics([]);
            setSelectedClinicId("");
            setHours(normalizeHoursFromAny(null));
          }
          return;
        }
        const d = { id: snap.id, ...snap.data() };
        const cls = sanitizeClinics(d.clinics);
        const defaultClinicId = cls.length === 1 ? cls[0].id : "";
        if (!cancel) {
          setDoctor(d);
          setClinics(cls);
          setSelectedClinicId(defaultClinicId);
          setHours(normalizeHoursFromAny(defaultClinicId ? cls[0] : d));
        }
      } finally {
        if (!cancel) setLoadingDoctor(false);
      }
    })();
    return () => { cancel = true; };
  }, [user?.uid]);

  // Lazy load patients when the field is opened (reduces initial render cost)
  const loadPatients = React.useCallback(async () => {
    if (loadingPatients || !user?.uid) return;
    setLoadingPatients(true);
    try {
      const qRef = query(collection(db, "patients"), where("registeredBy", "==", user.uid));
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
      setError(isArabic ? "حدث خطأ أثناء تحميل المرضى" : "Failed to load patients");
    } finally {
      setLoadingPatients(false);
    }
  }, [loadingPatients, user?.uid, isArabic]);

  // When the autocomplete opens the first time → fetch
  const handlePatientsOpen = () => {
    if (!patientsOpened) {
      setPatientsOpened(true);
      loadPatients();
    }
  };

  // When clinic selection changes, recompute hours (clinic hours → fallback to doctor)
  React.useEffect(() => {
    if (!doctor) return;
    if (selectedClinicId) {
      const c = clinics.find((x) => x.id === selectedClinicId);
      setHours(normalizeHoursFromAny(c || {}));
    } else {
      setHours(normalizeHoursFromAny(doctor));
    }
    setTimeStr("");
  }, [selectedClinicId, clinics, doctor]);

  // recompute slots and fetch booked for that day
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hours || !dateStr) {
          if (!cancelled) { setAllSlots([]); setBookedSet(new Set()); }
          return;
        }
        const d = new Date(dateStr + "T00:00:00");
        const k = weekdayKey(d);
        const ranges = parseDayRanges(hours[k]);
        let slots = buildSlotsForRanges(ranges, 30);

        const now = new Date();
        if (toYMD(now) === dateStr) {
          const nowMin = now.getHours() * 60 + now.getMinutes();
          slots = slots.filter((s) => minutes(s) > nowMin);
        }
        if (!cancelled) setAllSlots(slots);

        if (!user?.uid) return;
        const col = collection(db, "appointments");
        const [snapId, snapUID] = await Promise.all([
          getDocs(query(col, where("doctorId", "==", String(user.uid)), where("date", "==", dateStr))),
          getDocs(query(col, where("doctorUID", "==", String(user.uid)), where("date", "==", dateStr))),
        ]);
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

        // auto-pick first available time for speed
        if (!cancelled) {
          const first = slots.find((s) => !used.has(s));
          setTimeStr((prev) => (prev && slots.includes(prev) && !used.has(prev) ? prev : first || ""));
        }
      } catch (e) {
        if (!cancelled) {
          setAllSlots([]);
          setBookedSet(new Set());
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hours, dateStr, user?.uid, selectedClinicId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user?.uid) return;

    if (clinics.length > 1 && !selectedClinicId) {
      setError(isArabic ? "اختر العيادة أولاً" : "Please choose a clinic first");
      return;
    }
    if (!selectedPatient) {
      setError(isArabic ? "الرجاء اختيار مريض" : "Please select a patient");
      return;
    }
    if (!dateStr || !timeStr) {
      setError(isArabic ? "اختر التاريخ والوقت" : "Please choose date & time");
      return;
    }
    if (!availableSlots.includes(timeStr)) {
      setError(isArabic ? "الوقت المختار لم يعد متاحاً" : "Selected time is no longer available");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMsg("");

      const docNameEn = doctor?.name_en || "";
      const docNameAr = doctor?.name_ar || "";
      const specEn = doctor?.specialty_en || doctor?.specialty || "";
      const specAr = doctor?.specialty_ar || "";
      const price = doctor?.checkupPrice ?? null;

      const clinic = selectedClinicId ? clinics.find((c) => c.id === selectedClinicId) : null;
      const clinicName_en = clinic?.name_en || "";
      const clinicName_ar = clinic?.name_ar || "";

      await addDoc(collection(db, "appointments"), {
        doctorId: String(user.uid),
        doctorUID: String(user.uid),
        doctorName_en: docNameEn,
        doctorName_ar: docNameAr,
        doctorSpecialty_en: specEn,
        doctorSpecialty_ar: specAr,
        doctorPrice: price,
        clinicId: selectedClinicId || "",
        clinicName_en,
        clinicName_ar,
        date: dateStr,
        time: timeStr,
        queueDate: dateStr,
        queueTime: timeStr,
        queueKey: `${dateStr}T${timeStr}`,
        queueSource: "doctor_console",
        patientUid: selectedPatient.id,
        patientName: selectedPatient.name || "",
        patientPhone: selectedPatient.phone || selectedPatient.phoneNumber || "",
        patientEmail: selectedPatient.email || "",
        note: note.trim(),
        aiBrief: "",
        status: "confirmed",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMsg(
        isArabic
          ? `تم إنشاء الموعد. سيتم اختيار أول وقت متاح وترتيب الدور تلقائياً.`
          : `Appointment created. Picked the first available time and queue will auto-assign.`
      );
      setTimeStr("");
      setNote("");
    } catch (e) {
      console.error(e);
      setError(e?.message || (isArabic ? "فشل في إنشاء الموعد" : "Failed to create appointment"));
    } finally {
      setSubmitting(false);
    }
  }

  const backHref = `/appointments${isArabic ? "?lang=ar" : ""}`;
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
                  {/* Patient selector (lazy load) */}
                  <Autocomplete
                    onOpen={handlePatientsOpen}
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

                  {/* Time */}
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
            <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
          </Snackbar>

          {/* Success */}
          <Snackbar
            open={Boolean(successMsg)}
            autoHideDuration={3500}
            onClose={() => setSuccessMsg("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert severity="success" onClose={() => setSuccessMsg("")}>{successMsg}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
