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

      // تجهيز البيانات لتحديث patient في الصفحة
      const mergedForPatient = {
        // Arrays
        allergies: extracted.allergies || patient?.allergies || [],
        conditions: extracted.conditions || patient?.conditions || [],
        medications: extracted.medications || patient?.medications || [],

        // Demographics
        maritalStatus: extracted.maritalStatus || patient?.maritalStatus || "",
        bloodType: extracted.bloodType || patient?.bloodType || "",
        gender: extracted.gender || patient?.gender || "",
        age: extracted.age || patient?.age || "",

        // Notes (مسموح تكون mixed)
        notes: extracted.notes || patient?.notes || "",
      };

      if (typeof onExtract === "function") {
        onExtract(mergedForPatient);
      }

      if (data.warning) {
        setWarning(data.warning);
      }

      setSuccess(
        t(
          "Medical information extracted and profile updated.",
          "تم استخراج المعلومات الطبية وتحديث الملف الشخصي للمريض."
        )
      );
      setOpen(false);
      setFile(null);
    } catch (e) {
      console.error(e);
      setError(e.message || t("Upload failed", "فشل رفع الملف"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* MAIN BUTTON */}
      <Button
        variant="contained"
        sx={{
          borderRadius: 2,
          px: 2.5,
          py: 1,
          fontWeight: 700,
          background: "linear-gradient(135deg, #5D4042, #8c5a5c)",
          "&:hover": {
            background: "linear-gradient(135deg, #4f3436, #7a4d4f)",
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
            background: "linear-gradient(135deg, #ffffff, #faf7f7)",
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
                p: 3,
                borderRadius: 3,
                textAlign: "center",
                border: "2px dashed #bfbfbf",
                transition: "0.2s",
                cursor: "pointer",
                "&:hover": {
                  borderColor: "#5D4042",
                  backgroundColor: "#fdf8f7",
                },
              }}
              onClick={() =>
                document.getElementById("medical-file-input")?.click()
              }
            >
              <UploadFileIcon sx={{ fontSize: 38, color: "#5D4042" }} />
              <Typography sx={{ mt: 1, fontWeight: 600 }}>
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
              px: 3,
              py: 1,
              borderRadius: 3,
              fontWeight: 800,
              background: "linear-gradient(135deg, #5D4042, #8c5a5c)",
              "&:hover": {
                background: "linear-gradient(135deg, #4f3436, #7a4d4f)",
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
    </>
  );
}
