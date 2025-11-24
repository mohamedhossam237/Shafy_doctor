// /pages/appointments/new.js — add-or-select patient + additional fees + synced doctor timing + clinic selection
"use client";

import * as React from "react";
import { useRouter } from "next/router";
import {
  Container,
  Box,
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
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Grid,
  Chip,
  IconButton,
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
  query,
  where,
  serverTimestamp,
  doc,
} from "firebase/firestore";

import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import NoteAltIcon from "@mui/icons-material/NoteAlt";

/* ---------------- helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekdayKey = (date) =>
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
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
    (sourceObj.clinic &&
      (sourceObj.clinic.working_hours || sourceObj.clinic.workingHours)) ||
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
  const [addNewPatient, setAddNewPatient] = React.useState(false);
  const [newPatientName, setNewPatientName] = React.useState("");
  const [newPatientPhone, setNewPatientPhone] = React.useState("");

  /* doctor & clinic */
  const [doctor, setDoctor] = React.useState(null);
  const [clinics, setClinics] = React.useState([]);
  const [selectedClinicId, setSelectedClinicId] = React.useState("");
  const [hours, setHours] = React.useState(null);

  /* appointment form */
  const [dateStr, setDateStr] = React.useState(toYMD(new Date()));
  const [timeStr, setTimeStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [appointmentType, setAppointmentType] = React.useState("checkup"); // checkup | followup
  const [additionalFees, setAdditionalFees] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState(0);

  /* available slots */
  const [availableSlots, setAvailableSlots] = React.useState([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  /* ui */
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  /* ---- Load doctor ---- */
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "doctors", String(user.uid)));
        if (!snap.exists()) return;
        const d = { id: snap.id, ...snap.data() };
        setDoctor(d);
        setClinics(d.clinics || []);
        if (d.clinics?.length === 1) setSelectedClinicId(d.clinics[0].id);
        setHours(normalizeHoursFromAny(d));
        setTotalAmount(Number(d.checkupPrice || 0));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user?.uid]);

  /* ---- Load patients ---- */
  const loadPatients = async () => {
    if (!user?.uid) return;
    setLoadingPatients(true);
    try {
      const qRef = query(collection(db, "patients"), where("registeredBy", "==", user.uid));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPatients(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPatients(false);
    }
  };

  /* ---- Load available slots ---- */
  React.useEffect(() => {
    if (!doctor || !dateStr) return;
    setLoadingSlots(true);
    (async () => {
      try {
        const d = new Date(dateStr + "T00:00:00");
        const weekday = weekdayKey(d);
        const ranges = parseDayRanges(hours?.[weekday]);
        let slots = buildSlotsForRanges(ranges, 30);

        // Fetch booked appointments for doctor on that date
        const qRef = query(
          collection(db, "appointments"),
          where("doctorId", "==", user.uid),
          where("date", "==", dateStr)
        );
        const snap = await getDocs(qRef);
        const bookedTimes = snap.docs.map((doc) => doc.data().time);

        // Remove booked slots
        const available = slots.filter((s) => !bookedTimes.includes(s));
        setAvailableSlots(available);
      } catch (e) {
        console.error(e);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [doctor, dateStr, hours, user?.uid]);

  /* ---- Update total ---- */
  React.useEffect(() => {
    let base = 0;
    if (appointmentType === "checkup") {
      base = Number(doctor?.checkupPrice || 0);
    } else {
      base = Number(doctor?.followUpPrice || 0);
    }
    const extra = Number(additionalFees || 0);
    setTotalAmount(base + extra);
  }, [doctor?.checkupPrice, doctor?.followUpPrice, additionalFees, appointmentType]);

  /* ---- Submit ---- */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!user?.uid) return;

    let patientId = selectedPatient?.id;
    let patientName = selectedPatient?.name || "";
    let patientPhone = selectedPatient?.phone || "";

    if (addNewPatient) {
      if (!newPatientName.trim() || !newPatientPhone.trim()) {
        setError(isArabic ? "الرجاء إدخال اسم ورقم المريض" : "Please enter name and phone");
        return;
      }
      const pRef = await addDoc(collection(db, "patients"), {
        name: newPatientName.trim(),
        phone: newPatientPhone.trim(),
        registeredBy: user.uid,
        createdAt: serverTimestamp(),
      });
      patientId = pRef.id;
      patientName = newPatientName.trim();
      patientPhone = newPatientPhone.trim();
    } else if (!selectedPatient) {
      setError(isArabic ? "الرجاء اختيار مريض" : "Please select a patient");
      return;
    }

    if (!dateStr || !timeStr) {
      setError(isArabic ? "اختر التاريخ والوقت" : "Please choose date & time");
      return;
    }

    if (!selectedClinicId) {
      setError(isArabic ? "الرجاء اختيار العيادة" : "Please select a clinic");
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "appointments"), {
        doctorId: user.uid,
        doctorName_ar: doctor?.name_ar || "",
        doctorName_en: doctor?.name_en || "",
        doctorPrice: appointmentType === "checkup" ? (doctor?.checkupPrice || 0) : (doctor?.followUpPrice || 0),
        appointmentType,
        additionalFees: Number(additionalFees || 0),
        totalAmount,
        clinicId: selectedClinicId,
        date: dateStr,
        time: timeStr,
        patientUid: patientId,
        patientName,
        patientPhone,
        note: note.trim(),
        status: "confirmed",
        createdAt: serverTimestamp(),
      });

      setSuccessMsg(isArabic ? "تم إنشاء الموعد بنجاح ✅" : "Appointment created successfully ✅");
      setAddNewPatient(false);
      setNewPatientName("");
      setNewPatientPhone("");
      setSelectedPatient(null);
      setAdditionalFees("");
      setTimeStr("");
      setNote("");
      setSelectedClinicId("");
    } catch (e) {
      console.error(e);
      setError(e.message || (isArabic ? "فشل في إنشاء الموعد" : "Failed to create appointment"));
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
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h5" fontWeight={700}>
                {isArabic ? "إنشاء موعد جديد" : "Create New Appointment"}
              </Typography>
              <Button variant="text" onClick={() => router.push(backHref)}>
                {isArabic ? "العودة" : "Back"}
              </Button>
            </Stack>

            <Paper sx={{ p: 2.5, borderRadius: 2 }}>
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={addNewPatient}
                        onChange={(e) => setAddNewPatient(e.target.checked)}
                      />
                    }
                    label={isArabic ? "إضافة مريض جديد" : "Add new patient"}
                  />

                  {!addNewPatient ? (
                    <Autocomplete
                      onOpen={loadPatients}
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
                                {loadingPatients ? <CircularProgress size={18} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  ) : (
                    <Stack spacing={1}>
                      <TextField
                        label={isArabic ? "اسم المريض" : "Patient Name"}
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                      />
                      <TextField
                        label={isArabic ? "رقم الهاتف" : "Phone Number"}
                        value={newPatientPhone}
                        onChange={(e) => setNewPatientPhone(e.target.value)}
                      />
                    </Stack>
                  )}

                  <Divider />

                  {/* Clinic selection */}
                  {clinics.length > 0 && (
                    <TextField
                      select
                      label={isArabic ? "العيادة" : "Clinic"}
                      value={selectedClinicId}
                      onChange={(e) => {
                        setSelectedClinicId(e.target.value);
                        const selected = clinics.find((c) => c.id === e.target.value);
                        setHours(normalizeHoursFromAny(selected));
                      }}
                    >
                      {clinics.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {isArabic ? c.name_ar || c.name_en : c.name_en || c.name_ar}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}

                  <Divider />

                  {/* Appointment Type Selection */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="subtitle2" sx={{ minWidth: 80 }}>
                      {isArabic ? "نوع الكشف:" : "Type:"}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={appointmentType === "checkup" ? "contained" : "outlined"}
                        onClick={() => setAppointmentType("checkup")}
                        size="small"
                        sx={{
                          borderRadius: 4,
                          textTransform: "none",
                          boxShadow: "none",
                        }}
                      >
                        {isArabic ? "كشف جديد" : "Examination"}
                      </Button>
                      <Button
                        variant={appointmentType === "followup" ? "contained" : "outlined"}
                        onClick={() => setAppointmentType("followup")}
                        size="small"
                        sx={{
                          borderRadius: 4,
                          textTransform: "none",
                          boxShadow: "none",
                        }}
                      >
                        {isArabic ? "إعادة كشف" : "Re-examination"}
                      </Button>
                    </Stack>
                  </Stack>

                  <TextField
                    label={isArabic ? "التاريخ" : "Date"}
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: toYMD(new Date()) }}
                  />

                  <TextField
                    select
                    label={isArabic ? "الوقت" : "Time"}
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    disabled={loadingSlots}
                    helperText={
                      loadingSlots
                        ? isArabic
                          ? "جاري تحميل المواعيد..."
                          : "Loading slots..."
                        : ""
                    }
                  >
                    {availableSlots.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label={isArabic ? "رسوم إضافية" : "Additional Fees"}
                    type="number"
                    value={additionalFees}
                    onChange={(e) => setAdditionalFees(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">EGP</InputAdornment>,
                    }}
                  />

                  <TextField
                    label={isArabic ? "الإجمالي" : "Total"}
                    value={totalAmount}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">EGP</InputAdornment>,
                    }}
                  />

                  <TextField
                    label={isArabic ? "ملاحظات (اختياري)" : "Notes (optional)"}
                    multiline
                    minRows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  <Divider />

                  <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" onClick={() => router.push(backHref)}>
                      {isArabic ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={submitting}
                      sx={{ backgroundColor: "#5D4042", "&:hover": { backgroundColor: "#7b5557" } }}
                    >
                      {submitting
                        ? isArabic
                          ? "جاري الحجز..."
                          : "Booking..."
                        : isArabic
                          ? "تأكيد الحجز"
                          : "Book"}
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </Paper>
          </Stack>

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
