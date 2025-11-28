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
  alpha,
  useTheme
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  const theme = useTheme();

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
          py: 1.5,
          fontWeight: 800,
          background: (t) => `linear-gradient(135deg, ${t.palette.secondary.main}, ${t.palette.secondary.dark})`,
          boxShadow: (t) => `0 8px 20px -4px ${alpha(t.palette.secondary.main, 0.4)}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
          fontSize: '0.95rem',
          "&:hover": {
            transform: 'translateY(-2px)',
            boxShadow: (t) => `0 12px 24px -4px ${alpha(t.palette.secondary.main, 0.5)}`,
            background: (t) => `linear-gradient(135deg, ${t.palette.secondary.dark}, ${t.palette.secondary.main})`,
          },
        }}
        startIcon={<AutoAwesomeIcon />}
        onClick={() => setOpen(true)}
      >
        {t("AI Medical Extraction", "استخراج البيانات الطبية")}
      </Button>

      {/* UPLOAD POPUP */}
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
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: (t) => `1px solid ${t.palette.divider}`,
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
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              p: 1, borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
              color: 'secondary.main'
            }}>
              <CloudUploadIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                {t("Upload Medical File", "رفع ملف طبي")}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {t("AI will analyze and extract data", "سيقوم الذكاء الاصطناعي بتحليل واستخراج البيانات")}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setOpen(false)} disabled={loading} sx={{ bgcolor: 'action.hover' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderRadius: 3, border: 'none' }}>
          <Stack spacing={3} sx={{ py: 1 }}>
            {/* DROPZONE */}
            <Paper
              variant="outlined"
              sx={{
                p: 5,
                borderRadius: 4,
                textAlign: "center",
                border: (t) => `2px dashed ${file ? t.palette.success.main : t.palette.secondary.light}`,
                bgcolor: (t) => file ? alpha(t.palette.success.main, 0.04) : alpha(t.palette.secondary.main, 0.04),
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                position: 'relative',
                overflow: 'hidden',
                "&:hover": {
                  borderColor: (t) => file ? t.palette.success.dark : t.palette.secondary.main,
                  bgcolor: (t) => file ? alpha(t.palette.success.main, 0.08) : alpha(t.palette.secondary.main, 0.08),
                  transform: 'scale(1.01)',
                },
              }}
              onClick={() =>
                document.getElementById("medical-file-input")?.click()
              }
            >
              {file ? (
                <Stack alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 64, height: 64, borderRadius: '50%',
                    bgcolor: 'success.main', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 16px rgba(46, 125, 50, 0.2)'
                  }}>
                    <CheckCircleIcon sx={{ fontSize: 32 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                  <Button size="small" color="error" onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}>
                    {t("Remove", "إزالة")}
                  </Button>
                </Stack>
              ) : (
                <>
                  <Box sx={{
                    width: 80, height: 80, borderRadius: '50%',
                    bgcolor: 'background.paper', color: 'secondary.main',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 2,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
                  }}>
                    <UploadFileIcon sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>
                    {t("Click to select a file", "اضغط لاختيار ملف")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mx: 'auto' }}>
                    {t("Supports PDF, Word, DOCX, TXT. Max size 10MB.", "يدعم PDF, Word, DOCX, TXT. الحد الأقصى 10 ميجابايت.")}
                  </Typography>
                </>
              )}

              <HiddenInput
                id="medical-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setOpen(false)}
            disabled={loading}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              color: 'text.secondary',
              borderRadius: 2
            }}
          >
            {t("Cancel", "إلغاء")}
          </Button>

          <Button
            variant="contained"
            disabled={!file || loading}
            onClick={handleUpload}
            sx={{
              px: 4,
              py: 1.2,
              borderRadius: 2.5,
              fontWeight: 800,
              textTransform: 'none',
              background: (t) => `linear-gradient(135deg, ${t.palette.secondary.main}, ${t.palette.secondary.dark})`,
              boxShadow: (t) => `0 8px 20px -4px ${alpha(t.palette.secondary.main, 0.4)}`,
              "&:hover": {
                boxShadow: (t) => `0 12px 24px -4px ${alpha(t.palette.secondary.main, 0.5)}`,
              },
            }}
          >
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20} color="inherit" />
                <span>{t("Processing...", "جاري المعالجة...")}</span>
              </Stack>
            ) : (
              t("Analyze & Extract", "تحليل واستخراج")
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SUCCESS */}
      <Snackbar
        open={!!success}
        autoHideDuration={3500}
        onClose={() => setSuccess("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 3, fontWeight: 600 }}>
          {success}
        </Alert>
      </Snackbar>

      {/* WARNING */}
      <Snackbar
        open={!!warning}
        autoHideDuration={5000}
        onClose={() => setWarning("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" sx={{ borderRadius: 3, fontWeight: 600 }}>
          {warning}
        </Alert>
      </Snackbar>

      {/* ERROR */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" sx={{ borderRadius: 3, fontWeight: 600 }}>
          {error}
        </Alert>
      </Snackbar>

      {/* REVIEW DIALOG */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{
          fontWeight: 900,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.05)} 0%, ${alpha(t.palette.background.paper, 1)} 100%)`,
          pb: 2
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AutoAwesomeIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={900}>
                {t("Review Extracted Data", "مراجعة البيانات المستخرجة")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("Select the fields you want to update in the patient profile", "اختر الحقول التي تريد تحديثها في ملف المريض")}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
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
                  <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 800 }}>{t("Field", "الحقل")}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 800 }}>{t("Current Value", "القيمة الحالية")}</TableCell>
                  <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 800 }}>{t("Extracted Value", "القيمة المستخرجة")}</TableCell>
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
                  const isSelected = !!reviewSelection[field.key];

                  return (
                    <TableRow
                      key={field.key}
                      hover
                      selected={isSelected}
                      sx={{
                        '&.Mui-selected': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
                        '&.Mui-selected:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.12) }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => setReviewSelection(prev => ({ ...prev, [field.key]: e.target.checked }))}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{field.label}</TableCell>
                      <TableCell sx={{ color: 'text.disabled', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayOld}>
                        {displayOld}
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          multiline
                          size="small"
                          variant="standard"
                          value={displayNew}
                          InputProps={{
                            disableUnderline: true,
                            sx: { fontWeight: 600, color: 'text.primary' }
                          }}
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
        <DialogActions sx={{ p: 3, bgcolor: 'background.default' }}>
          <Button
            onClick={() => setReviewOpen(false)}
            color="inherit"
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            {t("Cancel", "إلغاء")}
          </Button>
          <Button
            onClick={handleSaveReview}
            variant="contained"
            disableElevation
            sx={{
              fontWeight: 800,
              borderRadius: 2.5,
              px: 4,
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
            }}
          >
            {t("Save Changes", "حفظ التغييرات")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
