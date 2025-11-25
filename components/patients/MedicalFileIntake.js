// components/patients/MedicalFileIntake.js
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  Paper,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  FormControlLabel,
  Switch
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { styled } from "@mui/material/styles";
import { useAuth } from "@/providers/AuthProvider";

const HiddenInput = styled("input")({
  display: "none",
});

export default function MedicalFileIntake({
  patientId,
  patient,
  isArabic,
  onExtract,
}) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");

  // Review State
  const [reviewOpen, setReviewOpen] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [reviewSelection, setReviewSelection] = useState({});

  const t = (en, ar) => (isArabic ? ar : en);

  const handleUpload = async () => {
    if (!file || !patientId) return;

    try {
      if (!user || !user.getIdToken) {
        throw new Error(
          t("Not authenticated. Please log in again.", "ليست هناك صلاحية، برجاء تسجيل الدخول مرة أخرى.")
        );
      }

      setLoading(true);
      setError("");
      setSuccess("");
      setWarning("");

      const idToken = await user.getIdToken();

      const form = new FormData();
      form.append("patientId", String(patientId));
      form.append("file", file);

      const res = await fetch("/api/intake-medical-file", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: form,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(
          data?.error || t("Server error while processing file.", "خطأ من الخادم أثناء معالجة الملف.")
        );
      }

      if (!data.ok) {
        throw new Error(
          data.error || t("AI failed to extract medical information.", "تعذر على الذكاء الاصطناعي استخراج المعلومات الطبية.")
        );
      }

      const extracted = data.extracted || {};

      // Prepare for review
      setExtractedData(extracted);

      // Default selection: select all non-empty extracted fields
      const initialSelection = {};
      Object.keys(extracted).forEach(key => {
        const val = extracted[key];
        if (Array.isArray(val)) {
          initialSelection[key] = val.length > 0;
        } else {
          initialSelection[key] = !!val;
        }
      });
      setReviewSelection(initialSelection);

      setOpen(false); // Close upload dialog
      setReviewOpen(true); // Open review dialog
      setFile(null);
      setLoading(false);

    } catch (e) {
      console.error(e);
      setError(e.message || t("Upload failed", "فشل رفع الملف"));
      setLoading(false);
    }
  };

  const handleSaveReview = () => {
    if (!extractedData) return;

    const mergedForPatient = { ...patient }; // Start with existing

    // Helper to merge or replace
    const applyField = (key) => {
      if (!reviewSelection[key]) return; // Skip if not selected

      const newVal = extractedData[key];
      const oldVal = patient?.[key];

      if (Array.isArray(newVal)) {
        // Merge arrays (unique)
        const combined = new Set([
          ...(Array.isArray(oldVal) ? oldVal : (typeof oldVal === 'string' ? oldVal.split(',') : [])),
          ...newVal
        ]);
        mergedForPatient[key] = Array.from(combined).filter(Boolean);
      } else {
        // Replace single value
        mergedForPatient[key] = newVal;
      }
    };

    // Apply all potential fields
    [
      'allergies', 'conditions', 'medications',
      'maritalStatus', 'bloodType', 'gender', 'age',
      'weight', 'height', 'bloodPressure', 'temperature',
      'phone', 'email', 'address',
      'isSmoker', 'drinksAlcohol',
      'notes'
    ].forEach(applyField);

    if (typeof onExtract === "function") {
      onExtract(mergedForPatient);
    }

    setSuccess(t("Profile updated successfully.", "تم تحديث الملف بنجاح."));
    setReviewOpen(false);
    setExtractedData(null);
  };

  return (
    <>
      {/* MAIN BUTTON */}
      <Button
        variant="contained"
        sx={{
          borderRadius: 3,
          px: 3,
          py: 1.2,
          fontWeight: 800,
          background: (t) => `linear-gradient(135deg, ${t.palette.info.main}, ${t.palette.info.dark})`,
          boxShadow: '0 4px 12px rgba(1, 135, 134, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          "&:hover": {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 16px rgba(1, 135, 134, 0.4)',
            background: (t) => `linear-gradient(135deg, ${t.palette.info.dark}, ${t.palette.info.main})`,
          },
        }}
        startIcon={<CloudUploadIcon />}
        onClick={() => setOpen(true)}
      >
        {t("Upload Medical File", "رفع ملف طبي")}
      </Button>

      {/* POPUP */}
      <Dialog
        open={open}
        onClose={() => !loading && setOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            background: (t) => `linear-gradient(135deg, ${t.palette.background.paper} 0%, ${t.palette.grey[50]} 100%)`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
          }}
        >
          {t("Upload Medical File", "رفع ملف طبي")}
          <IconButton onClick={() => setOpen(false)} disabled={loading}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderRadius: 3 }}>
          <Stack spacing={2}>
            {/* DROPZONE */}
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                borderRadius: 3,
                textAlign: "center",
                border: (t) => `3px dashed ${t.palette.info.light}`,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                background: (t) => `linear-gradient(135deg, ${t.palette.background.default} 0%, ${t.palette.grey[50]} 100%)`,
                "&:hover": {
                  borderColor: (t) => t.palette.info.main,
                  backgroundColor: (t) => t.palette.info.light + '10',
                  transform: 'scale(1.02)',
                  boxShadow: (t) => `0 4px 16px ${t.palette.info.main}30`,
                },
              }}
              onClick={() =>
                document.getElementById("medical-file-input")?.click()
              }
            >
              <UploadFileIcon sx={{ fontSize: 48, color: "info.main", mb: 1 }} />
              <Typography sx={{ mt: 1, fontWeight: 700, fontSize: '1.05rem' }}>
                {t(
                  "Click to select a medical file",
                  "اضغط لاختيار ملف طبي"
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF, Word, DOCX, TXT
              </Typography>

              <HiddenInput
                id="medical-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Paper>

            {/* PREVIEW */}
            {file && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "#f7f3f3",
                  border: "1px solid #e0dddd",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  {t("Selected file:", "الملف المختار:")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {file.name}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setOpen(false)}
            disabled={loading}
            sx={{ textTransform: "none" }}
          >
            {t("Cancel", "إلغاء")}
          </Button>

          <Button
            variant="contained"
            disabled={!file || loading}
            onClick={handleUpload}
            sx={{
              px: 3.5,
              py: 1.2,
              borderRadius: 3,
              fontWeight: 900,
              background: (t) => `linear-gradient(135deg, ${t.palette.info.main}, ${t.palette.info.dark})`,
              boxShadow: '0 4px 12px rgba(1, 135, 134, 0.3)',
              transition: 'all 0.3s ease',
              "&:hover": {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(1, 135, 134, 0.4)',
                background: (t) => `linear-gradient(135deg, ${t.palette.info.dark}, ${t.palette.info.main})`,
              },
            }}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              t("Upload", "رفع")
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SUCCESS */}
      <Snackbar
        open={!!success}
        autoHideDuration={3500}
        onClose={() => setSuccess("")}
      >
        <Alert severity="success" variant="filled">
          {success}
        </Alert>
      </Snackbar>

      {/* WARNING (مثلاً AI وقع واشتغل fallback) */}
      <Snackbar
        open={!!warning}
        autoHideDuration={5000}
        onClose={() => setWarning("")}
      >
        <Alert severity="warning" variant="filled">
          {warning}
        </Alert>
      </Snackbar>

      {/* ERROR */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError("")}
      >
        <Alert severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>

      {/* REVIEW DIALOG */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {t("Review Extracted Data", "مراجعة البيانات المستخرجة")}
        </DialogTitle>
        <DialogContent dividers>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={Object.values(reviewSelection).every(Boolean)}
                      indeterminate={Object.values(reviewSelection).some(Boolean) && !Object.values(reviewSelection).every(Boolean)}
                      onChange={(e) => {
                        const all = {};
                        if (extractedData) {
                          Object.keys(extractedData).forEach(k => all[k] = e.target.checked);
                          setReviewSelection(all);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell><strong>{t("Field", "الحقل")}</strong></TableCell>
                  <TableCell><strong>{t("Current Value", "القيمة الحالية")}</strong></TableCell>
                  <TableCell><strong>{t("Extracted Value", "القيمة المستخرجة")}</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { key: 'age', label: t('Age', 'العمر') },
                  { key: 'gender', label: t('Gender', 'الجنس') },
                  { key: 'weight', label: t('Weight', 'الوزن') },
                  { key: 'height', label: t('Height', 'الطول') },
                  { key: 'bloodPressure', label: t('Blood Pressure', 'ضغط الدم') },
                  { key: 'temperature', label: t('Temperature', 'درجة الحرارة') },
                  { key: 'phone', label: t('Phone', 'الهاتف') },
                  { key: 'email', label: t('Email', 'البريد') },
                  { key: 'address', label: t('Address', 'العنوان') },
                  { key: 'maritalStatus', label: t('Marital Status', 'الحالة الاجتماعية') },
                  { key: 'bloodType', label: t('Blood Type', 'فصيلة الدم') },
                  { key: 'allergies', label: t('Allergies', 'الحساسيات') },
                  { key: 'conditions', label: t('Conditions', 'الأمراض المزمنة') },
                  { key: 'medications', label: t('Medications', 'الأدوية') },
                  { key: 'diagnosis', label: t('Diagnosis', 'التشخيص') },
                  { key: 'findings', label: t('Findings', 'الموجودات السريرية') },
                  { key: 'labResults', label: t('Lab Results', 'نتائج التحاليل') },
                  { key: 'procedures', label: t('Procedures', 'الإجراءات') },
                  { key: 'notes', label: t('Notes', 'ملاحظات') },
                ].map((field) => {
                  const newVal = extractedData?.[field.key];
                  if (!newVal || (Array.isArray(newVal) && newVal.length === 0)) return null;

                  const oldVal = patient?.[field.key];

                  let displayNew = String(newVal);
                  if (Array.isArray(newVal)) {
                    if (field.key === 'labResults') {
                      displayNew = newVal.map(l => `${l.test || ''} ${l.value || ''} ${l.unit || ''} ${l.flag || ''}`.trim()).join('\n');
                    } else {
                      displayNew = newVal.join(', ');
                    }
                  }

                  const displayOld = Array.isArray(oldVal) ? oldVal.join(', ') : (oldVal || '—');

                  return (
                    <TableRow key={field.key} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!!reviewSelection[field.key]}
                          onChange={(e) => setReviewSelection(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        />
                      </TableCell>
                      <TableCell>{field.label}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayOld}>
                        {displayOld}
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          multiline
                          size="small"
                          variant="standard"
                          value={displayNew}
                          InputProps={{ disableUnderline: true }}
                          onChange={(e) => {
                            if (!Array.isArray(newVal)) {
                              setExtractedData(prev => ({ ...prev, [field.key]: e.target.value }));
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReviewOpen(false)} color="inherit">{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSaveReview} variant="contained" disableElevation>
            {t("Save Changes", "حفظ التغييرات")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
