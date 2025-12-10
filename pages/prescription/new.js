// /pages/prescription/new.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Button,
  TextField,
  Autocomplete,
  CircularProgress,
  Grid,
  IconButton,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
  MenuItem,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Fade,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MedicationIcon from '@mui/icons-material/Medication';
import ScienceIcon from '@mui/icons-material/Science';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PersonIcon from '@mui/icons-material/Person';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import EventIcon from '@mui/icons-material/Event';
import HealingIcon from '@mui/icons-material/Healing';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { alpha } from '@mui/material/styles';
import { uploadImageToImgbb } from '@/components/reports/utils/imgbb';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';
import { useAuth } from '@/providers/AuthProvider';

export default function NewPrescriptionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);
  const dir = isArabic ? 'rtl' : 'ltr';

  // State
  const [patients, setPatients] = React.useState([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState(null);
  const [patientInfo, setPatientInfo] = React.useState({ mrn: '', sex: '', dobStr: '', phone: '' });

  // Form state (all fields from dialog)
  const [form, setForm] = React.useState({
    titleAr: '',
    titleEn: '',
    dateStr: '',
    diagnosis: '',
    findings: '',
    procedures: '',
    chiefComplaint: '',
    vitalsBP: '',
    vitalsHR: '',
    vitalsTemp: '',
    vitalsSpO2: '',
  });

  // Attachment state
  const [previewURL, setPreviewURL] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [imgbbURL, setImgbbURL] = React.useState('');
  const [attaching, setAttaching] = React.useState(false);

  // Vitals extra fields
  const [extraVitalsFields, setExtraVitalsFields] = React.useState([]);
  const [vitalsDialogOpen, setVitalsDialogOpen] = React.useState(false);
  const [selectedVitalField, setSelectedVitalField] = React.useState('');
  const [customVitalField, setCustomVitalField] = React.useState('');

  // AI suggestions for clinical fields
  const [aiSuggestions, setAiSuggestions] = React.useState({ field: '', items: [] });
  const [aiLoading, setAiLoading] = React.useState(false);

  const [medicationsList, setMedicationsList] = React.useState([
    { name: '', dose: '', frequency: '', duration: '', notes: '' },
  ]);

  const [testsList, setTestsList] = React.useState([{ name: '', notes: '' }]);

  const [drugOptions, setDrugOptions] = React.useState([]);
  const [drugLoading, setDrugLoading] = React.useState(true);

  const [allTests, setAllTests] = React.useState([]);
  const [testsLoading, setTestsLoading] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const [errors, setErrors] = React.useState({});
  
  // Doctor specialty
  const [doctorSpecialty, setDoctorSpecialty] = React.useState({ key: '', ar: '', en: '' });

  // Load doctor specialty
  React.useEffect(() => {
    if (!user?.uid) return;
    const loadDoctorSpecialty = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'doctors', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDoctorSpecialty({
            key: data.specialty_key || '',
            ar: data.specialty_ar || '',
            en: data.specialty_en || '',
          });
        }
      } catch (err) {
        console.error('Failed to load doctor specialty:', err);
      }
    };
    loadDoctorSpecialty();
  }, [user?.uid]);

  // Load patients
  React.useEffect(() => {
    if (!user?.uid) return;

    setPatientsLoading(true);
    try {
      const col = collection(db, 'patients');
      const q1 = query(col, where('associatedDoctors', 'array-contains', user.uid));
      const q2 = query(col, where('registeredBy', '==', user.uid));

      const unsub1 = onSnapshot(q1, (snap1) => {
        const data1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

        const unsub2 = onSnapshot(q2, (snap2) => {
          const data2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

          const combined = [...data1, ...data2];
          const unique = Object.values(
            combined.reduce((acc, cur) => {
              acc[cur.id] = cur;
              return acc;
            }, {})
          );

          const withPhone = unique.filter(
            (p) => typeof p.phone === 'string' && p.phone.trim() !== ''
          );

          withPhone.sort((a, b) =>
            (a?.name ?? '').localeCompare(b?.name ?? '', undefined, { sensitivity: 'base' })
          );

          setPatients(withPhone);
          setPatientsLoading(false);
        });

        return () => {
          unsub1();
          unsub2();
        };
      });
    } catch (err) {
      console.error(err);
      setPatientsLoading(false);
    }
  }, [user?.uid]);

  // Load medicines
  React.useEffect(() => {
    const loadMedicines = async () => {
      try {
        const res = await fetch('/data/medicines.min.json');
        const json = await res.json();
        setDrugOptions(json);
      } catch (err) {
        console.error('Failed loading medicines:', err);
      } finally {
        setDrugLoading(false);
      }
    };
    loadMedicines();
  }, []);

  // Load tests
  React.useEffect(() => {
    const loadTests = async () => {
      try {
        const res = await fetch('/data/medical_tests_list.json');
        if (!res.ok) throw new Error('Failed to load test list');
        const data = await res.json();
        const names = data.map((t) => t.TestName?.trim()).filter(Boolean);
        setAllTests(names);
      } catch (err) {
        console.error('Error loading JSON:', err);
        setAllTests([]);
      } finally {
        setTestsLoading(false);
      }
    };
    loadTests();
  }, []);

  // Fetch patient demographics
  const fetchPatientInfo = async (patientId) => {
    try {
      if (!patientId) {
        setPatientInfo({ mrn: '', sex: '', dobStr: '', phone: '' });
        return;
      }

      const snap = await getDoc(doc(db, 'patients', patientId));
      const data = snap.exists() ? snap.data() : {};

      const dob =
        data?.dob instanceof Date
          ? data.dob
          : data?.dob?.toDate
          ? data.dob.toDate()
          : data?.dob
          ? new Date(data.dob)
          : null;

      const dobStr = dob && !isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : '';

      setPatientInfo({
        mrn: data?.mrn || data?.medicalRecordNumber || '',
        sex: data?.sex || data?.gender || '',
        dobStr,
        phone: data?.phone || data?.mobile || '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Medications handlers
  const addMedication = () =>
    setMedicationsList((prev) => [
      ...prev,
      { name: '', dose: '', frequency: '', duration: '', notes: '' },
    ]);

  const removeMedication = (i) =>
    setMedicationsList((prev) => prev.filter((_, idx) => idx !== i));

  const updateMedication = (i, key, val) =>
    setMedicationsList((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [key]: val } : m))
    );

  // Tests handlers
  const addTest = () => setTestsList((prev) => [...prev, { name: '', notes: '' }]);

  const removeTest = (i) => setTestsList((prev) => prev.filter((_, idx) => idx !== i));

  const updateTest = (i, key, val) =>
    setTestsList((prev) => prev.map((m, idx) => (idx === i ? { ...m, [key]: val } : m)));

  // Filter drugs
  const filterDrugs = React.useCallback((q = '', list = []) => {
    const n = q.toLowerCase().trim();
    if (!n) return list.slice(0, 100);
    return list
      .filter(
        (d) =>
          d.displayName?.toLowerCase().includes(n) ||
          d.genericName?.toLowerCase().includes(n) ||
          d.brandName?.toLowerCase().includes(n)
      )
      .slice(0, 100);
  }, []);

  // Filter tests
  const filterTests = React.useCallback((q = '') => {
    if (!q) return allTests.slice(0, 50);
    const qLower = q.toLowerCase();
    return allTests.filter((t) => t.toLowerCase().includes(qLower)).slice(0, 30);
  }, [allTests]);

  // Form change handler
  const handleFormChange = (key) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    
    // AI suggestions for clinical fields
    if (['diagnosis', 'findings', 'procedures', 'chiefComplaint'].includes(key)) {
      const debounceRef = setTimeout(() => {
        fetchAiSuggestions(key, val);
      }, 600);
      return () => clearTimeout(debounceRef);
    }
  };

  // Handle field focus - show mockups immediately for all fields
  const handleFieldFocus = (field) => () => {
    loadFieldMockups(field);
  };

  // Component to render AI suggestions above any field
  const AISuggestionsBox = ({ field, onSelect }) => {
    if (aiSuggestions.field !== field) return null;
    
    if (aiLoading) {
      return (
        <Box sx={{ mb: 1.5, textAlign: 'center', py: 1 }}>
          <CircularProgress size={20} sx={{ color: '#8a4baf' }} />
        </Box>
      );
    }

    if (aiSuggestions.items.length === 0) return null;

    return (
      <Fade in timeout={400}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 1.5, 
            p: 2, 
            borderRadius: 3, 
            background: 'linear-gradient(135deg, rgba(138, 75, 175, 0.08) 0%, rgba(186, 104, 200, 0.05) 100%)',
            border: '1.5px solid',
            borderColor: 'rgba(138, 75, 175, 0.2)',
            boxShadow: '0 4px 12px rgba(138, 75, 175, 0.1)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AutoAwesomeIcon fontSize="small" sx={{ color: '#8a4baf' }} />
            <Typography variant="caption" fontWeight={700} color="#8a4baf">
              {t('AI Suggestions', 'اقتراحات الذكاء الاصطناعي')}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {aiSuggestions.items.map((s, i) => (
              <Chip
                key={i}
                label={s}
                onClick={() => onSelect(s)}
                variant="outlined"
                sx={{
                  borderColor: '#8a4baf',
                  color: '#8a4baf',
                  fontWeight: 600,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    bgcolor: '#8a4baf', 
                    color: '#fff', 
                    borderColor: '#8a4baf',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(138, 75, 175, 0.3)',
                  },
                }}
              />
            ))}
          </Stack>
        </Paper>
      </Fade>
    );
  };

  // Load AI suggestions mockups on field focus (no text needed)
  const loadFieldMockups = async (field) => {
    if (!doctorSpecialty.key && !doctorSpecialty.ar) {
      setAiSuggestions({ field: '', items: [] });
      return;
    }
    
    setAiLoading(true);
    setAiSuggestions({ field, items: [] });
    
    try {
      const token = user ? await user.getIdToken() : '';
      
      const specialtyName = isArabic ? doctorSpecialty.ar : doctorSpecialty.en;
      const specialtyKey = doctorSpecialty.key;
      
      // Field-specific prompts with specialty - generate mockups directly
      const fieldPrompts = {
        titleAr: `Generate 5 professional medical report title examples in Arabic for a ${specialtyName} (${specialtyKey}) specialist. These should be concise, professional titles (max 60 characters). Return a JSON array of 5 titles.`,
        titleEn: `Generate 5 professional medical report title examples in English for a ${specialtyName} (${specialtyKey}) specialist. These should be concise, professional titles (max 60 characters). Return a JSON array of 5 titles.`,
        chiefComplaint: `Generate 5 professional chief complaint mockup/template examples for a ${specialtyName} (${specialtyKey}) specialist. These should be complete, ready-to-use sentences that a ${specialtyName} doctor would typically document. Return a JSON array of 5 complete mockup sentences in ${isArabic ? 'Arabic' : 'English'}.`,
        diagnosis: `Generate 5 professional diagnosis mockup/template examples for a ${specialtyName} (${specialtyKey}) specialist. Include common diagnoses with ICD codes if relevant. Return a JSON array of 5 complete diagnosis statements in ${isArabic ? 'Arabic' : 'English'}.`,
        findings: `Generate 5 clinical examination findings mockup/template examples for a ${specialtyName} (${specialtyKey}) specialist. These should be complete findings statements that a ${specialtyName} doctor would typically document. Return a JSON array of 5 complete findings statements in ${isArabic ? 'Arabic' : 'English'}.`,
        procedures: `Generate 5 medical procedures/treatments mockup/template examples for a ${specialtyName} (${specialtyKey}) specialist. Include common procedures with CPT codes if relevant. Return a JSON array of 5 complete procedure statements in ${isArabic ? 'Arabic' : 'English'}.`,
        vitalsBP: `Generate 5 common blood pressure values (in format "XXX/XX mmHg") that a ${specialtyName} specialist would typically record. Return a JSON array of 5 values.`,
        vitalsHR: `Generate 5 common heart rate values (in bpm) that a ${specialtyName} specialist would typically record. Return a JSON array of 5 values.`,
        vitalsTemp: `Generate 5 common body temperature values (in Celsius) that a ${specialtyName} specialist would typically record. Return a JSON array of 5 values.`,
        vitalsSpO2: `Generate 5 common SpO2 (oxygen saturation) values (in percentage) that a ${specialtyName} specialist would typically record. Return a JSON array of 5 values.`,
        medication_name: `Generate 5 common medication names that a ${specialtyName} (${specialtyKey}) specialist would typically prescribe. Return a JSON array of 5 medication names in ${isArabic ? 'Arabic' : 'English'}.`,
        medication_dose: `Generate 5 common medication dose examples (e.g., "500mg", "1 tablet", "10ml") that a ${specialtyName} specialist would typically prescribe. Return a JSON array of 5 dose examples.`,
        medication_frequency: `Generate 5 common medication frequency examples (e.g., "Once daily", "Twice daily", "Every 8 hours") that a ${specialtyName} specialist would typically prescribe. Return a JSON array of 5 frequency examples in ${isArabic ? 'Arabic' : 'English'}.`,
        medication_duration: `Generate 5 common medication duration examples (e.g., "7 days", "2 weeks", "1 month") that a ${specialtyName} specialist would typically prescribe. Return a JSON array of 5 duration examples in ${isArabic ? 'Arabic' : 'English'}.`,
        test_name: `Generate 5 common medical test/investigation names that a ${specialtyName} (${specialtyKey}) specialist would typically order. Return a JSON array of 5 test names in ${isArabic ? 'Arabic' : 'English'}.`,
        test_notes: `Generate 5 common test preparation instructions (e.g., "Fasting 8 hours", "No food 12 hours before") that a ${specialtyName} specialist would typically provide. Return a JSON array of 5 instruction examples in ${isArabic ? 'Arabic' : 'English'}.`,
      };
      
      // Handle dynamic fields (medication_name_0, test_name_1, etc.)
      let baseField = field;
      if (field.startsWith('medication_name_') || field.startsWith('medication_dose_') || 
          field.startsWith('medication_frequency_') || field.startsWith('medication_duration_')) {
        baseField = field.replace(/_\d+$/, '');
      } else if (field.startsWith('test_name_') || field.startsWith('test_notes_')) {
        baseField = field.replace(/_\d+$/, '');
      }
      
      const prompt = fieldPrompts[baseField] || fieldPrompts[field] || `Generate 5 professional ${baseField || field} mockup examples for a ${specialtyName} specialist. Return a JSON array.`;
      
      const res = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: prompt,
          lang: isArabic ? 'ar' : 'en',
          enable_rag: false,
          use_server_context: false,
        }),
      });

      const data = await res.json();
      const raw = data?.text || '';
      let parsed = [];

      try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) parsed = j;
        else if (typeof j === 'object') parsed = Object.values(j);
        else if (typeof j === 'string') parsed = j.split(/[\n,]+/);
      } catch {
        parsed =
          raw
            ?.split(/[\n,]+/)
            ?.map((x) => x.trim())
            ?.filter((x) => x.length > 1) || [];
      }

      if (!Array.isArray(parsed)) parsed = [];
      setAiSuggestions({ field, items: parsed.slice(0, 5) });
    } catch (err) {
      console.error('AI suggest error:', err);
      setAiSuggestions({ field: '', items: [] });
    } finally {
      setAiLoading(false);
    }
  };

  // AI suggestions with doctor specialty context (for when user types)
  const fetchAiSuggestions = async (field, text) => {
    if (!text || text.length < 3) {
      // If no text, show mockups instead
      if (aiSuggestions.field === field) return; // Already showing mockups
      await loadFieldMockups(field);
      return;
    }
    setAiLoading(true);
    try {
      const token = user ? await user.getIdToken() : '';
      
      // Get specialty context
      const specialtyContext = doctorSpecialty.key 
        ? `in a ${isArabic ? doctorSpecialty.ar : doctorSpecialty.en} (${doctorSpecialty.key}) context`
        : 'in a medical context';
      
      // Field-specific prompts with specialty
      const fieldPrompts = {
        chiefComplaint: `Generate a professional chief complaint mockup/template based on the specialty "${isArabic ? doctorSpecialty.ar : doctorSpecialty.en}" for a patient presenting with: "${text}". Return a JSON array of 3-5 complete mockup sentences that a ${isArabic ? doctorSpecialty.ar || 'doctor' : doctorSpecialty.en || 'doctor'} would typically document.`,
        diagnosis: `Suggest professional diagnosis mockups/templates based on the specialty "${isArabic ? doctorSpecialty.ar : doctorSpecialty.en}" for: "${text}". Include ICD codes if relevant. Return a JSON array of 3-5 complete diagnosis statements that a ${isArabic ? doctorSpecialty.ar || 'doctor' : doctorSpecialty.en || 'doctor'} would typically use.`,
        findings: `Generate clinical examination findings mockup/template based on the specialty "${isArabic ? doctorSpecialty.ar : doctorSpecialty.en}" for: "${text}". Return a JSON array of 3-5 complete findings statements that a ${isArabic ? doctorSpecialty.ar || 'doctor' : doctorSpecialty.en || 'doctor'} would typically document.`,
        procedures: `Suggest medical procedures/treatments mockup/template based on the specialty "${isArabic ? doctorSpecialty.ar : doctorSpecialty.en}" for: "${text}". Include CPT codes if relevant. Return a JSON array of 3-5 complete procedure statements that a ${isArabic ? doctorSpecialty.ar || 'doctor' : doctorSpecialty.en || 'doctor'} would typically document.`,
      };
      
      const prompt = fieldPrompts[field] || `Suggest relevant ${field} terms or phrases for "${text}" ${specialtyContext}. Return a JSON array of short suggestions.`;
      
      const res = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: prompt,
          lang: isArabic ? 'ar' : 'en',
          enable_rag: false,
          use_server_context: false,
        }),
      });

      const data = await res.json();
      const raw = data?.text || '';
      let parsed = [];

      try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) parsed = j;
        else if (typeof j === 'object') parsed = Object.values(j);
        else if (typeof j === 'string') parsed = j.split(/[\n,]+/);
      } catch {
        parsed =
          raw
            ?.split(/[\n,]+/)
            ?.map((x) => x.trim())
            ?.filter((x) => x.length > 1) || [];
      }

      if (!Array.isArray(parsed)) parsed = [];
      setAiSuggestions({ field, items: parsed.slice(0, 5) });
    } catch (err) {
      console.error('AI suggest error:', err);
      setAiSuggestions({ field: '', items: [] });
    } finally {
      setAiLoading(false);
    }
  };

  const insertSuggestion = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setAiSuggestions({ field: '', items: [] });
  };

  // Attachment handlers
  const handleFilePick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Only image files are supported.', 'الصور فقط مدعومة.'),
      });
      return;
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(f));
    setFileName(f.name);

    setAttaching(true);
    try {
      const hosted = await uploadImageToImgbb(f);
      setImgbbURL(hosted);
      setSnack({
        open: true,
        severity: 'success',
        msg: t('Image uploaded successfully.', 'تم رفع الصورة بنجاح.'),
      });
    } catch (err) {
      console.error(err);
      setImgbbURL('');
      setSnack({
        open: true,
        severity: 'error',
        msg: err?.message || t('Failed to upload image.', 'فشل رفع الصورة.'),
      });
    } finally {
      setAttaching(false);
    }
  };

  const clearFile = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL('');
    setFileName('');
    setImgbbURL('');
  };

  // Vitals handlers
  const handleVitalsChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [`vitals${field.toUpperCase()}`]: e.target.value,
    }));
  };

  const availableVitalsFields = [
    { key: 'weight', label: t('Weight', 'الوزن'), unit: 'kg' },
    { key: 'height', label: t('Height', 'الطول'), unit: 'cm' },
    { key: 'bmi', label: t('BMI', 'مؤشر كتلة الجسم') },
    { key: 'sugar', label: t('Blood Sugar', 'سكر الدم'), unit: 'mg/dL' },
    { key: 'resp', label: t('Respiratory Pattern', 'نمط التنفس') },
    { key: 'pain', label: t('Pain Level', 'مستوى الألم') },
  ];

  const handleAddVitalField = () => {
    if (selectedVitalField === 'custom' && customVitalField.trim()) {
      setExtraVitalsFields((prev) => [
        ...prev,
        { key: customVitalField.toLowerCase().replace(/\s+/g, ''), label: customVitalField, custom: true },
      ]);
    } else {
      const field = availableVitalsFields.find((f) => f.key === selectedVitalField);
      if (field && !extraVitalsFields.some((ef) => ef.key === field.key)) {
        setExtraVitalsFields((prev) => [...prev, field]);
      }
    }
    setVitalsDialogOpen(false);
    setSelectedVitalField('');
    setCustomVitalField('');
  };

  // Auto BMI
  React.useEffect(() => {
    const weight = parseFloat(form.vitalsWEIGHT);
    const height = parseFloat(form.vitalsHEIGHT);
    if (weight && height) {
      const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
      setForm((prev) => ({ ...prev, vitalsBMI: bmi }));
    }
  }, [form.vitalsWEIGHT, form.vitalsHEIGHT]);

  // Auto-fill title with AI
  const autoFillTitle = React.useCallback(async () => {
    const hasData = 
      form.diagnosis?.trim() || 
      form.findings?.trim() || 
      form.procedures?.trim() || 
      form.chiefComplaint?.trim() ||
      medicationsList.some((m) => m.name?.trim()) ||
      testsList.some((t) => t.name?.trim());

    if (!hasData || (form.titleAr?.trim() && form.titleEn?.trim())) return;

    try {
      const token = user ? await user.getIdToken() : '';
      const dataSummary = [
        form.diagnosis && `Diagnosis: ${form.diagnosis}`,
        form.chiefComplaint && `Chief Complaint: ${form.chiefComplaint}`,
        form.findings && `Findings: ${form.findings.substring(0, 100)}`,
        medicationsList.filter((m) => m.name?.trim()).length > 0 && `Medications: ${medicationsList.filter((m) => m.name?.trim()).length} items`,
        testsList.filter((t) => t.name?.trim()).length > 0 && `Tests: ${testsList.filter((t) => t.name?.trim()).length} items`,
      ].filter(Boolean).join('\n');

      if (!dataSummary) return;

      const res = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `Based on this medical report data, generate a concise title in ${isArabic ? 'Arabic' : 'English'} (max 60 characters):\n\n${dataSummary}\n\nReturn only the title, no explanation.`,
          lang: isArabic ? 'ar' : 'en',
          enable_rag: false,
          use_server_context: false,
        }),
      });

      const data = await res.json();
      const title = (data?.text || '').trim().replace(/["']/g, '').substring(0, 60);
      
      if (title && isArabic && !form.titleAr?.trim()) {
        setForm((prev) => ({ ...prev, titleAr: title }));
      } else if (title && !isArabic && !form.titleEn?.trim()) {
        setForm((prev) => ({ ...prev, titleEn: title }));
      }
    } catch (err) {
      console.error('AI title generation error:', err);
    }
  }, [form.diagnosis, form.findings, form.procedures, form.chiefComplaint, medicationsList, testsList, form.titleAr, form.titleEn, isArabic, user]);

  // Auto-fill title when data changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      autoFillTitle();
    }, 2000);
    return () => clearTimeout(timer);
  }, [autoFillTitle]);

  // Save prescription
  const handleSave = async () => {
    if (!selectedPatient) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please select a patient.', 'يرجى اختيار المريض.'),
      });
      return;
    }

    // Check if at least one field has data
    const hasAnyData = 
      form.titleAr?.trim() ||
      form.titleEn?.trim() ||
      form.diagnosis?.trim() ||
      form.findings?.trim() ||
      form.procedures?.trim() ||
      form.chiefComplaint?.trim() ||
      form.vitalsBP?.trim() ||
      form.vitalsHR?.trim() ||
      form.vitalsTemp?.trim() ||
      form.vitalsSpO2?.trim() ||
      extraVitalsFields.some((f) => form[`vitals${f.key.toUpperCase()}`]?.trim()) ||
      medicationsList.some((m) => m.name?.trim()) ||
      testsList.some((t) => t.name?.trim()) ||
      imgbbURL?.trim();

    if (!hasAnyData) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please fill at least one field.', 'يرجى ملء حقل واحد على الأقل.'),
      });
      return;
    }

    setSubmitting(true);
    try {
      // Filter valid medications and tests (keep all entered data)
      const validMedications = medicationsList.filter((m) => m.name?.trim());
      const validTests = testsList.filter((t) => t.name?.trim());

      // Prepare all data
      const allData = {
        ...form,
        medicationsList: validMedications,
        testsList: validTests,
        imgbbURL,
        extraVitalsFields: extraVitalsFields.map((f) => ({
          key: f.key,
          label: f.label,
          value: form[`vitals${f.key.toUpperCase()}`] || '',
        })),
      };

      // Save to reports collection (for reports list)
      await addDoc(collection(db, 'reports'), {
        type: 'clinical',
        patientID: selectedPatient.id,
        patientName: selectedPatient.name,
        ...allData,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        appointmentId: router.query.appointmentId || null,
      });

      // Save to patient profile (all data)
      const patientRef = doc(db, 'patients', selectedPatient.id);
      const prescriptionData = {
        ...allData,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        appointmentId: router.query.appointmentId || null,
      };

      // Add to prescriptions array in patient profile
      await updateDoc(patientRef, {
        prescriptions: arrayUnion(prescriptionData),
        updatedAt: serverTimestamp(),
      });

      setSnack({
        open: true,
        severity: 'success',
        msg: t('Prescription saved successfully!', 'تم حفظ الوصفة بنجاح!'),
      });

      // Reset form
      setSelectedPatient(null);
      setPatientInfo({ mrn: '', sex: '', dobStr: '', phone: '' });
      setForm({
        titleAr: '',
        titleEn: '',
        dateStr: '',
        diagnosis: '',
        findings: '',
        procedures: '',
        chiefComplaint: '',
        vitalsBP: '',
        vitalsHR: '',
        vitalsTemp: '',
        vitalsSpO2: '',
      });
      setPreviewURL('');
      setFileName('');
      setImgbbURL('');
      setExtraVitalsFields([]);
      setMedicationsList([{ name: '', dose: '', frequency: '', duration: '', notes: '' }]);
      setTestsList([{ name: '', notes: '' }]);

      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/patient-reports${isArabic ? '?lang=ar' : ''}`);
      }, 1500);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Failed to save prescription.', 'فشل حفظ الوصفة.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Share prescription via WhatsApp
  const handleWhatsAppShare = () => {
    if (!selectedPatient) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please select a patient first.', 'يرجى اختيار المريض أولاً.'),
      });
      return;
    }

    const hasMedications = medicationsList.some((m) => m.name?.trim());
    const hasTests = testsList.some((t) => t.name?.trim());

    if (!hasMedications && !hasTests) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please add at least one medication or test.', 'يرجى إضافة دواء أو فحص واحد على الأقل.'),
      });
      return;
    }

    const patientPhone = patientInfo.phone || selectedPatient.phone || '';
    if (!patientPhone) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Patient phone number is required for WhatsApp sharing.', 'رقم هاتف المريض مطلوب للمشاركة عبر واتساب.'),
      });
      return;
    }

    // Format phone number (remove non-digits, ensure Egyptian format with +20)
    const phoneRaw = String(patientPhone || '').replace(/\D/g, '');
    if (!phoneRaw) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Invalid phone number.', 'رقم الهاتف غير صحيح.'),
      });
      return;
    }
    
    // Always treat as Egyptian number: +20 (Egypt country code)
    // Remove leading zeros and ensure it starts with +20
    let phoneDigits = phoneRaw.replace(/^0+/, '');
    let formattedPhone;
    
    if (phoneDigits.startsWith('20')) {
      // Already has country code 20
      formattedPhone = `+${phoneDigits}`;
    } else {
      // Add +20 (Egypt country code)
      formattedPhone = `+20${phoneDigits}`;
    }

    // Build prescription message
    const patientName = selectedPatient.name || selectedPatient.id || t('Patient', 'المريض');
    const today = new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US');
    
    const messageLines = [
      isArabic ? '📋 وصفة طبية' : '📋 Medical Prescription',
      '',
      `${isArabic ? 'اسم المريض' : 'Patient Name'}: ${patientName}`,
      `${isArabic ? 'التاريخ' : 'Date'}: ${today}`,
      '',
    ];

    // Add medications
    const medications = medicationsList.filter((m) => m.name?.trim());
    if (medications.length > 0) {
      messageLines.push(isArabic ? '💊 الأدوية:' : '💊 Medications:');
      medications.forEach((m) => {
        const medLine = `• ${m.name || ''}`;
        const details = [];
        if (m.dose) details.push(`${isArabic ? 'الجرعة' : 'Dose'}: ${m.dose}`);
        if (m.frequency) details.push(`${isArabic ? 'التكرار' : 'Frequency'}: ${m.frequency}`);
        if (m.duration) details.push(`${isArabic ? 'المدة' : 'Duration'}: ${m.duration}`);
        if (m.notes) details.push(m.notes);
        messageLines.push(medLine + (details.length > 0 ? ` (${details.join(', ')})` : ''));
      });
      messageLines.push('');
    }

    // Add tests
    const tests = testsList.filter((t) => t.name?.trim());
    if (tests.length > 0) {
      messageLines.push(isArabic ? '🔬 الفحوصات المطلوبة:' : '🔬 Required Tests:');
      tests.forEach((t) => {
        const testLine = `• ${t.name || ''}`;
        if (t.notes) {
          messageLines.push(`${testLine} - ${t.notes}`);
        } else {
          messageLines.push(testLine);
        }
      });
    }

    const message = messageLines.join('\n');
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Print prescription
  const handlePrint = () => {
    if (!selectedPatient) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please select a patient first.', 'يرجى اختيار المريض أولاً.'),
      });
      return;
    }

    const hasMedications = medicationsList.some((m) => m.name?.trim());
    const hasTests = testsList.some((t) => t.name?.trim());

    if (!hasMedications && !hasTests) {
      setSnack({
        open: true,
        severity: 'error',
        msg: t('Please add at least one medication or test.', 'يرجى إضافة دواء أو فحص واحد على الأقل.'),
      });
      return;
    }

    // Create print window
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      setSnack({
        open: true,
        severity: 'warning',
        msg: t('Please enable popups to print.', 'يرجى تفعيل النوافذ المنبثقة للطباعة.'),
      });
      return;
    }

    const doctorName = user?.displayName || user?.email || '';
    const today = new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US');

    const medicationsHtml = medicationsList
      .filter((m) => m.name?.trim())
      .map(
        (m) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.name || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${m.dose || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${m.frequency || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${m.duration || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.notes || ''}</td>
      </tr>
    `
      )
      .join('');

    const testsHtml = testsList
      .filter((t) => t.name?.trim())
      .map(
        (t) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${t.name || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${t.notes || ''}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="${dir}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${t('Prescription', 'وصفة طبية')}</title>
        <style>
          @page {
            size: A5;
            margin: 15mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Arial', 'Tahoma', sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #000;
            padding: 20px;
            direction: ${dir};
            text-align: ${isArabic ? 'right' : 'left'};
          }
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .patient-info {
            margin-bottom: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .patient-info p {
            margin: 3px 0;
            font-size: 11px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ccc;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          table th {
            background: #f0f0f0;
            padding: 8px;
            text-align: ${isArabic ? 'right' : 'left'};
            font-weight: bold;
            font-size: 11px;
            border: 1px solid #ddd;
          }
          table td {
            padding: 8px;
            border: 1px solid #ddd;
            font-size: 11px;
          }
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            text-align: ${isArabic ? 'right' : 'left'};
            font-size: 10px;
          }
          .signature {
            margin-top: 30px;
            text-align: ${isArabic ? 'right' : 'left'};
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t('Medical Prescription', 'وصفة طبية')}</h1>
        </div>

        <div class="patient-info">
          <p><strong>${t('Patient Name', 'اسم المريض')}:</strong> ${selectedPatient.name}</p>
          ${patientInfo.mrn ? `<p><strong>${t('MRN', 'رقم الملف')}:</strong> ${patientInfo.mrn}</p>` : ''}
          ${patientInfo.phone ? `<p><strong>${t('Phone', 'الهاتف')}:</strong> ${patientInfo.phone}</p>` : ''}
          <p><strong>${t('Date', 'التاريخ')}:</strong> ${today}</p>
        </div>

        ${medicationsHtml ? `
        <div class="section">
          <div class="section-title">${t('Medications', 'الأدوية')}</div>
          <table>
            <thead>
              <tr>
                <th>${t('Medicine', 'الدواء')}</th>
                <th style="text-align: center;">${t('Dose', 'الجرعة')}</th>
                <th style="text-align: center;">${t('Frequency', 'التكرار')}</th>
                <th style="text-align: center;">${t('Duration', 'المدة')}</th>
                <th>${t('Notes', 'ملاحظات')}</th>
              </tr>
            </thead>
            <tbody>
              ${medicationsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${testsHtml ? `
        <div class="section">
          <div class="section-title">${t('Medical Tests', 'الفحوصات الطبية')}</div>
          <table>
            <thead>
              <tr>
                <th>${t('Test Name', 'اسم الفحص')}</th>
                <th>${t('Notes / Instructions', 'ملاحظات / تعليمات')}</th>
              </tr>
            </thead>
            <tbody>
              ${testsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          <div class="signature">
            <p><strong>${t('Doctor', 'الطبيب')}:</strong> ${doctorName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Protected>
      <AppLayout>
        <Box 
          dir={dir} 
          sx={{ 
            minHeight: '100vh', 
            pb: 4,
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.02) 0%, rgba(66, 165, 245, 0.01) 50%, rgba(156, 39, 176, 0.02) 100%)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 50%, rgba(25, 118, 210, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(66, 165, 245, 0.04) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(156, 39, 176, 0.03) 0%, transparent 50%)',
              pointerEvents: 'none',
              zIndex: 0,
            },
          }}
        >
          <Container maxWidth="md" sx={{ py: 2, position: 'relative', zIndex: 1 }}>
            {/* Header */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #9c27b0 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 3s ease-in-out infinite',
                },
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '200% 0' },
                  '100%': { backgroundPosition: '-200% 0' },
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Button
                  component={Link}
                  href={`/patient-reports${isArabic ? '?lang=ar' : ''}`}
                  startIcon={isArabic ? null : <ArrowBackIcon />}
                  endIcon={isArabic ? <ArrowBackIcon /> : null}
                  sx={{
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.5,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('Back', 'رجوع')}
                </Button>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    startIcon={<WhatsAppIcon />}
                    onClick={handleWhatsAppShare}
                    sx={{
                      minWidth: 140,
                      borderRadius: 2.5,
                      textTransform: 'none',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #20BA5A 0%, #0E7A6E 100%)',
                        boxShadow: '0 6px 16px rgba(37, 211, 102, 0.4)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t('Share via WhatsApp', 'مشاركة عبر واتساب')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{
                      minWidth: 120,
                      borderRadius: 2.5,
                      textTransform: 'none',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                      boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                        boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t('Print', 'طباعة')}
                  </Button>
                </Stack>
              </Stack>

              <Typography 
                variant="h4" 
                fontWeight={900} 
                sx={{ 
                  mb: 1,
                  background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 50%, #9c27b0 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t('New Prescription', 'وصفة طبية جديدة')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
                {t('Create a medical prescription with medications and tests.', 'إنشاء وصفة طبية تحتوي على الأدوية والفحوصات.')}
              </Typography>
            </Paper>

            {/* Patient Selection */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #1976d2 0%, #42a5f5 50%, #64b5f6 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
                  }}
                >
                  <PersonIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  fontWeight={800}
                  sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('Patient Information', 'معلومات المريض')}
                </Typography>
              </Stack>

              <Autocomplete
                options={patients}
                loading={patientsLoading}
                value={selectedPatient}
                onChange={async (_, value) => {
                  setSelectedPatient(value);
                  await fetchPatientInfo(value?.id);
                }}
                getOptionLabel={(opt) => opt?.name || ''}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                noOptionsText={t('No patients found', 'لا يوجد مرضى')}
                filterOptions={(options, { inputValue }) => {
                  if (!inputValue) return options;
                  const q = inputValue.toLowerCase();
                  return options.filter((opt) => {
                    const name = (opt.name || '').toLowerCase();
                    const phone = (opt.phone || '').toLowerCase();
                    return name.includes(q) || phone.includes(q);
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('Select Patient', 'اختر المريض')}
                    placeholder={t('Search by name or phone', 'ابحث بالاسم أو الهاتف')}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {patientsLoading && <CircularProgress size={18} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              {selectedPatient && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {[
                    { label: t('MRN', 'رقم الملف'), value: patientInfo.mrn },
                    { label: t('Sex', 'النوع'), value: patientInfo.sex },
                    { label: t('DOB', 'تاريخ الميلاد'), value: patientInfo.dobStr },
                    { label: t('Phone', 'الهاتف'), value: patientInfo.phone },
                  ].map((item, idx) => (
                    <Grid item xs={6} sm={3} key={idx}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(66, 165, 245, 0.03) 100%)',
                          border: '1px solid',
                          borderColor: 'rgba(25, 118, 210, 0.1)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(66, 165, 245, 0.05) 100%)',
                            borderColor: 'rgba(25, 118, 210, 0.2)',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {item.value || '-'}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>

            {/* Attachment Section */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #9c27b0 0%, #ba68c8 50%, #ce93d8 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(156, 39, 176, 0.3)',
                  }}
                >
                  <NoteAltIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  fontWeight={800}
                  sx={{
                    background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('Attachment', 'المرفق')}
                </Typography>
              </Stack>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                  <Tooltip title={t('Attach report image', 'إرفاق صورة التقرير')}>
                    <Button 
                      variant="outlined" 
                      startIcon={<AddPhotoAlternateIcon />} 
                      component="label"
                      sx={{
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 2.5,
                        borderWidth: 2,
                        borderColor: 'secondary.main',
                        color: 'secondary.main',
                        '&:hover': {
                          borderWidth: 2,
                          borderColor: 'secondary.dark',
                          background: 'rgba(156, 39, 176, 0.08)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(156, 39, 176, 0.2)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {t('Attach Image', 'إرفاق صورة')}
                      <input type="file" hidden accept="image/*" onChange={handleFilePick} />
                    </Button>
                  </Tooltip>
                  {fileName && (
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 240 }}>
                      {fileName}
                    </Typography>
                  )}
                  {previewURL && (
                    <Button color="error" size="small" onClick={clearFile}>
                      {t('Remove', 'إزالة')}
                    </Button>
                  )}
                </Stack>
                {attaching && (
                  <Stack sx={{ minWidth: 220 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('Uploading image…', 'جاري رفع الصورة…')}
                    </Typography>
                    <LinearProgress />
                  </Stack>
                )}
                {!!previewURL && (
                  <Box
                    sx={{
                      mt: 1.5,
                      width: '100%',
                      borderRadius: 2,
                      border: (t2) => `1px solid ${t2.palette.divider}`,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        aspectRatio: '16 / 9',
                        backgroundImage: `url(${previewURL})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  </Box>
                )}
              </Stack>
            </Paper>

            {/* Meta Section */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(255, 152, 0, 0.3)',
                  }}
                >
                  <EventIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  fontWeight={800}
                  sx={{
                    background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('Report Meta', 'بيانات التقرير')}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <AISuggestionsBox 
                    field="titleAr" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, titleAr: val }))} 
                  />
                  <TextField
                    label={t('Title (Arabic)', 'العنوان (عربي)')}
                    fullWidth
                    value={form.titleAr}
                    onChange={handleFormChange('titleAr')}
                    onFocus={handleFieldFocus('titleAr')}
                    helperText=" "
                    inputProps={{ maxLength: 80 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <AISuggestionsBox 
                    field="titleEn" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, titleEn: val }))} 
                  />
                  <TextField
                    label={t('Title (English)', 'العنوان (إنجليزي)')}
                    fullWidth
                    value={form.titleEn}
                    onChange={handleFormChange('titleEn')}
                    onFocus={handleFieldFocus('titleEn')}
                    helperText=" "
                    inputProps={{ maxLength: 80 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    type="datetime-local"
                    label={t('Date', 'التاريخ')}
                    value={form.dateStr}
                    onChange={handleFormChange('dateStr')}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    helperText=" "
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EventIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Clinical Section */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(76, 175, 80, 0.3)',
                  }}
                >
                  <HealingIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  fontWeight={800}
                  sx={{
                    background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('Clinical Details', 'التفاصيل السريرية')}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <AISuggestionsBox 
                    field="chiefComplaint" 
                    onSelect={(val) => insertSuggestion('chiefComplaint', val)} 
                  />
                  <TextField
                    label={t('Chief Complaint', 'الشكوى الرئيسية')}
                    fullWidth
                    value={form.chiefComplaint}
                    onChange={handleFormChange('chiefComplaint')}
                    onFocus={handleFieldFocus('chiefComplaint')}
                    inputProps={{ maxLength: 160 }}
                    helperText={`${form.chiefComplaint.length}/160`}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <AISuggestionsBox 
                    field="diagnosis" 
                    onSelect={(val) => insertSuggestion('diagnosis', val)} 
                  />
                  <TextField
                    label={t('Diagnosis (ICD if available)', 'التشخيص (إن وُجد ICD)')}
                    fullWidth
                    value={form.diagnosis}
                    onChange={handleFormChange('diagnosis')}
                    onFocus={handleFieldFocus('diagnosis')}
                    helperText={`${form.diagnosis.length}/200`}
                    inputProps={{ maxLength: 200 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <AISuggestionsBox 
                    field="findings" 
                    onSelect={(val) => insertSuggestion('findings', val)} 
                  />
                  <TextField
                    label={t('Findings / Examination', 'النتائج / الفحص')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.findings}
                    onChange={handleFormChange('findings')}
                    onFocus={handleFieldFocus('findings')}
                    inputProps={{ maxLength: 800 }}
                    helperText={`${form.findings.length}/800`}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <AISuggestionsBox 
                    field="procedures" 
                    onSelect={(val) => insertSuggestion('procedures', val)} 
                  />
                  <TextField
                    label={t('Procedures (CPT if available)', 'الإجراءات (إن وُجد CPT)')}
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.procedures}
                    onChange={handleFormChange('procedures')}
                    onFocus={handleFieldFocus('procedures')}
                    inputProps={{ maxLength: 600 }}
                    helperText={`${form.procedures.length}/600`}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Vitals Section */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #f44336 0%, #ef5350 50%, #e57373 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #f44336 0%, #ef5350 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(244, 67, 54, 0.3)',
                  }}
                >
                  <FavoriteIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  fontWeight={800}
                  sx={{
                    background: 'linear-gradient(135deg, #f44336 0%, #ef5350 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {t('Vital Signs', 'العلامات الحيوية')}
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <AISuggestionsBox 
                    field="vitalsBP" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, vitalsBP: val }))} 
                  />
                  <TextField
                    select
                    label={t('Blood Pressure', 'ضغط الدم')}
                    value={form.vitalsBP}
                    onChange={handleVitalsChange('bp')}
                    onFocus={handleFieldFocus('vitalsBP')}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">mmHg</InputAdornment>,
                    }}
                  >
                    {['100/60', '105/65', '110/70', '115/75', '120/80', '125/85', '130/90', '135/95', '140/100'].map((v) => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AISuggestionsBox 
                    field="vitalsHR" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, vitalsHR: val }))} 
                  />
                  <TextField
                    select
                    label={t('Heart Rate', 'نبض القلب')}
                    value={form.vitalsHR}
                    onChange={handleVitalsChange('hr')}
                    onFocus={handleFieldFocus('vitalsHR')}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">bpm</InputAdornment>,
                    }}
                  >
                    {['55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '110'].map((v) => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AISuggestionsBox 
                    field="vitalsTemp" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, vitalsTemp: val }))} 
                  />
                  <TextField
                    select
                    label={t('Temperature', 'درجة الحرارة')}
                    value={form.vitalsTemp}
                    onChange={handleVitalsChange('temp')}
                    onFocus={handleFieldFocus('vitalsTemp')}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                    }}
                  >
                    {['36.0', '36.3', '36.5', '36.7', '37.0', '37.3', '37.5', '37.8', '38.0', '38.5', '39.0'].map((v) => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AISuggestionsBox 
                    field="vitalsSpO2" 
                    onSelect={(val) => setForm((prev) => ({ ...prev, vitalsSpO2: val }))} 
                  />
                  <TextField
                    select
                    label={t('SpO₂', 'نسبة الأوكسجين')}
                    value={form.vitalsSpO2}
                    onChange={handleVitalsChange('spo2')}
                    onFocus={handleFieldFocus('vitalsSpO2')}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                  >
                    {['90', '92', '93', '94', '95', '96', '97', '98', '99', '100'].map((v) => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {extraVitalsFields.map((field) => (
                  <Grid item xs={12} sm={6} md={3} key={field.key}>
                    <TextField
                      label={field.label}
                      value={form[`vitals${field.key.toUpperCase()}`] || ''}
                      onChange={handleVitalsChange(field.key)}
                      fullWidth
                      InputProps={{
                        endAdornment: field.unit ? <InputAdornment position="end">{field.unit}</InputAdornment> : null,
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ mt: 3 }}>
                <Button
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => setVitalsDialogOpen(true)}
                  variant="outlined"
                >
                  {t('Add Field', 'إضافة حقل جديد')}
                </Button>
              </Box>
              <Dialog open={vitalsDialogOpen} onClose={() => setVitalsDialogOpen(false)}>
                <DialogTitle>{t('Add New Field', 'إضافة حقل جديد')}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>{t('Select Field', 'اختر الحقل')}</InputLabel>
                    <Select
                      value={selectedVitalField}
                      label={t('Select Field', 'اختر الحقل')}
                      onChange={(e) => setSelectedVitalField(e.target.value)}
                    >
                      {availableVitalsFields.map((f) => (
                        <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
                      ))}
                      <MenuItem value="custom">{t('Custom Field', 'حقل مخصص')}</MenuItem>
                    </Select>
                  </FormControl>
                  {selectedVitalField === 'custom' && (
                    <TextField
                      label={t('Custom Field Name', 'اسم الحقل المخصص')}
                      value={customVitalField}
                      onChange={(e) => setCustomVitalField(e.target.value)}
                      fullWidth
                    />
                  )}
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setVitalsDialogOpen(false)}>{t('Cancel', 'إلغاء')}</Button>
                  <Button onClick={handleAddVitalField} variant="contained">{t('Add', 'إضافة')}</Button>
                </DialogActions>
              </Dialog>
            </Paper>

            {/* Medications */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 16px rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    <MedicationIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography 
                    variant="h6" 
                    fontWeight={800}
                    sx={{
                      background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {t('Medications', 'الأدوية')}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={addMedication}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(33, 150, 243, 0.2)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('Add', 'إضافة')}
                </Button>
              </Stack>

              <Stack spacing={2}>
                {medicationsList.map((m, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderStyle: 'dashed',
                      borderColor: (t) => alpha(t.palette.divider, 0.8),
                    }}
                  >
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <AISuggestionsBox 
                          field={`medication_name_${idx}`} 
                          onSelect={(val) => updateMedication(idx, 'name', val)} 
                        />
                        <Autocomplete
                          freeSolo
                          autoHighlight
                          loading={drugLoading}
                          options={filterDrugs(m.name || '', drugOptions)}
                          value={m.name || ''}
                          onInputChange={(_, v) => {
                            updateMedication(idx, 'name', v || '');
                          }}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`medication_name_${idx}`);
                            }
                          }}
                          getOptionLabel={(opt) => {
                            if (typeof opt === 'string') return opt;
                            return opt.displayName || opt.brandName || opt.genericName || '';
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t('Medicine name', 'اسم الدواء')}
                              fullWidth
                              size="small"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <AISuggestionsBox 
                          field={`medication_dose_${idx}`} 
                          onSelect={(val) => updateMedication(idx, 'dose', val)} 
                        />
                        <TextField
                          label={t('Dose', 'الجرعة')}
                          fullWidth
                          size="small"
                          value={m.dose}
                          onChange={(e) => updateMedication(idx, 'dose', e.target.value)}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`medication_dose_${idx}`);
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <AISuggestionsBox 
                          field={`medication_frequency_${idx}`} 
                          onSelect={(val) => updateMedication(idx, 'frequency', val)} 
                        />
                        <TextField
                          label={t('Frequency', 'التكرار')}
                          fullWidth
                          size="small"
                          value={m.frequency}
                          onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`medication_frequency_${idx}`);
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <AISuggestionsBox 
                          field={`medication_duration_${idx}`} 
                          onSelect={(val) => updateMedication(idx, 'duration', val)} 
                        />
                        <TextField
                          label={t('Duration', 'المدة')}
                          fullWidth
                          size="small"
                          value={m.duration}
                          onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`medication_duration_${idx}`);
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={1.5}>
                        <IconButton
                          color="error"
                          onClick={() => removeMedication(idx)}
                          size="small"
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Paper>

            {/* Tests */}
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                mb: 3, 
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
                  transform: 'translateY(-2px)',
                },
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #00bcd4 0%, #26c6da 50%, #4dd0e1 100%)',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #00bcd4 0%, #26c6da 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 16px rgba(0, 188, 212, 0.3)',
                    }}
                  >
                    <ScienceIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography 
                    variant="h6" 
                    fontWeight={800}
                    sx={{
                      background: 'linear-gradient(135deg, #00bcd4 0%, #26c6da 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {t('Medical Tests', 'الفحوصات الطبية')}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={addTest}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderWidth: 2,
                    borderColor: 'info.main',
                    color: 'info.main',
                    '&:hover': {
                      borderWidth: 2,
                      borderColor: 'info.dark',
                      background: 'rgba(0, 188, 212, 0.08)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 188, 212, 0.2)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('Add', 'إضافة')}
                </Button>
              </Stack>

              <Stack spacing={2}>
                {testsList.map((testItem, idx) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      borderColor: (t2) => alpha(t2.palette.info.main, 0.3),
                      background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.02) 0%, rgba(38, 198, 218, 0.01) 100%)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: (t2) => alpha(t2.palette.info.main, 0.5),
                        background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.04) 0%, rgba(38, 198, 218, 0.02) 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0, 188, 212, 0.1)',
                      },
                    }}
                  >
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} md={5}>
                        <AISuggestionsBox 
                          field={`test_name_${idx}`} 
                          onSelect={(val) => updateTest(idx, 'name', val)} 
                        />
                        <Autocomplete
                          freeSolo
                          options={filterTests(testItem.name || '')}
                          loading={testsLoading}
                          value={testItem.name || ''}
                          onInputChange={(_, v) => {
                            updateTest(idx, 'name', v || '');
                          }}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`test_name_${idx}`);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t('Test / Investigation', 'الفحص / التحليل')}
                              placeholder={t('Type to search or choose a test…', 'اكتب أو اختر فحصًا…')}
                              fullWidth
                              size="small"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <AISuggestionsBox 
                          field={`test_notes_${idx}`} 
                          onSelect={(val) => updateTest(idx, 'notes', val)} 
                        />
                        <TextField
                          label={t('Notes / Instructions', 'ملاحظات / تعليمات')}
                          fullWidth
                          size="small"
                          value={testItem.notes}
                          onChange={(e) => updateTest(idx, 'notes', e.target.value)}
                          onFocus={() => {
                            if (doctorSpecialty.key) {
                              loadFieldMockups(`test_notes_${idx}`);
                            }
                          }}
                          placeholder={t('Fasting 8 hours, etc.', 'صيام ٨ ساعات مثلاً')}
                        />
                      </Grid>
                      <Grid item xs={12} md="auto">
                        <IconButton
                          color="error"
                          onClick={() => removeTest(idx)}
                          size="small"
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Paper>

            {/* Actions */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1.5px solid',
                borderColor: 'rgba(255,255,255,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => router.push(`/patient-reports${isArabic ? '?lang=ar' : ''}`)}
                  sx={{
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('Cancel', 'إلغاء')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={submitting}
                  sx={{
                    minWidth: 140,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                      boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                      transform: 'translateY(-2px)',
                    },
                    '&:disabled': {
                      background: 'rgba(0,0,0,0.12)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {submitting ? <CircularProgress size={20} color="inherit" /> : t('Save', 'حفظ')}
                </Button>
              </Stack>
            </Paper>
          </Container>
        </Box>

        {/* Snackbar */}
        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity}>{snack.msg}</Alert>
        </Snackbar>
      </AppLayout>
    </Protected>
  );
}

