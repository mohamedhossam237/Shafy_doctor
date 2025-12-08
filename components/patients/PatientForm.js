'use client';
import * as React from 'react';
import {
    Grid, TextField, MenuItem, Stack, Button, Box, Typography,
    Paper, Accordion, AccordionSummary, AccordionDetails, InputAdornment
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import HomeIcon from '@mui/icons-material/Home';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import CakeIcon from '@mui/icons-material/Cake';
import WcIcon from '@mui/icons-material/Wc';
import EventIcon from '@mui/icons-material/Event';

export default function PatientForm({ isArabic, initialValues, onSubmit }) {
    const [values, setValues] = React.useState(
        initialValues || {
            name: '',
            age: '',
            gender: '',
            bloodType: '',
            phone: '',
            email: '',
            address: '',
            allergies: '',
            conditions: '',
            medications: '',
            maritalStatus: '',
            lastVisit: ''
        }
    );
    const [submitting, setSubmitting] = React.useState(false);
    const [expanded, setExpanded] = React.useState('basic');

    const handleChange = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

    const handleAccordion = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit?.(values, { setSubmitting });
    };

    const label = (en, ar) => isArabic ? ar : en;

    return (
        <form onSubmit={submit}>
            <Stack spacing={2}>
                {/* Basic Information */}
                <Accordion
                    expanded={expanded === 'basic'}
                    onChange={handleAccordion('basic')}
                    sx={{ borderRadius: 2, '&:before': { display: 'none' } }}
                    elevation={0}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: 'action.hover',
                            borderRadius: expanded === 'basic' ? '8px 8px 0 0' : 2,
                            '&:hover': { bgcolor: 'action.selected' }
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <PersonIcon color="primary" />
                            <Typography fontWeight={700}>{label('Basic Information', 'المعلومات الأساسية')}</Typography>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Patient Name', 'اسم المريض')}
                                    value={values.name}
                                    onChange={handleChange('name')}
                                    required
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={label('Age', 'العمر')}
                                    type="number"
                                    value={values.age}
                                    onChange={handleChange('age')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <CakeIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label={label('Gender', 'النوع')}
                                    value={values.gender}
                                    onChange={handleChange('gender')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <WcIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                >
                                    <MenuItem value="male">{label('Male', 'ذكر')}</MenuItem>
                                    <MenuItem value="female">{label('Female', 'أنثى')}</MenuItem>
                                    <MenuItem value="other">{label('Other', 'آخر')}</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label={label('Blood Type', 'فصيلة الدم')}
                                    value={values.bloodType}
                                    onChange={handleChange('bloodType')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <BloodtypeIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                >
                                    <MenuItem value="A+">A+</MenuItem>
                                    <MenuItem value="A-">A-</MenuItem>
                                    <MenuItem value="B+">B+</MenuItem>
                                    <MenuItem value="B-">B-</MenuItem>
                                    <MenuItem value="AB+">AB+</MenuItem>
                                    <MenuItem value="AB-">AB-</MenuItem>
                                    <MenuItem value="O+">O+</MenuItem>
                                    <MenuItem value="O-">O-</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label={label('Marital Status', 'الحالة الاجتماعية')}
                                    value={values.maritalStatus}
                                    onChange={handleChange('maritalStatus')}
                                >
                                    <MenuItem value="single">{label('Single', 'أعزب')}</MenuItem>
                                    <MenuItem value="married">{label('Married', 'متزوج')}</MenuItem>
                                    <MenuItem value="divorced">{label('Divorced', 'مطلق')}</MenuItem>
                                    <MenuItem value="widowed">{label('Widowed', 'أرمل')}</MenuItem>
                                </TextField>
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>

                {/* Contact Information */}
                <Accordion
                    expanded={expanded === 'contact'}
                    onChange={handleAccordion('contact')}
                    sx={{ borderRadius: 2, '&:before': { display: 'none' } }}
                    elevation={0}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: 'action.hover',
                            borderRadius: expanded === 'contact' ? '8px 8px 0 0' : 2,
                            '&:hover': { bgcolor: 'action.selected' }
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <PhoneIcon color="success" />
                            <Typography fontWeight={700}>{label('Contact Information', 'معلومات الاتصال')}</Typography>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={label('Phone Number', 'رقم الهاتف')}
                                    value={values.phone}
                                    onChange={handleChange('phone')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PhoneIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={label('Email', 'البريد الإلكتروني')}
                                    type="email"
                                    value={values.email}
                                    onChange={handleChange('email')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Address', 'العنوان')}
                                    multiline
                                    rows={2}
                                    value={values.address}
                                    onChange={handleChange('address')}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                                                <HomeIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>

                {/* Medical Background */}
                <Accordion
                    expanded={expanded === 'medical'}
                    onChange={handleAccordion('medical')}
                    sx={{ borderRadius: 2, '&:before': { display: 'none' } }}
                    elevation={0}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            bgcolor: 'action.hover',
                            borderRadius: expanded === 'medical' ? '8px 8px 0 0' : 2,
                            '&:hover': { bgcolor: 'action.selected' }
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <MedicalServicesIcon color="error" />
                            <Typography fontWeight={700}>{label('Medical Background', 'الخلفية الطبية')}</Typography>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Allergies (comma-separated)', 'الحساسيات (مفصولة بفاصلة)')}
                                    multiline
                                    rows={2}
                                    value={values.allergies}
                                    onChange={handleChange('allergies')}
                                    placeholder={label('e.g., Penicillin, Peanuts', 'مثلا: بنسلين، فول سوداني')}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Chronic Conditions (comma-separated)', 'الأمراض المزمنة (مفصولة بفاصلة)')}
                                    multiline
                                    rows={2}
                                    value={values.conditions}
                                    onChange={handleChange('conditions')}
                                    placeholder={label('e.g., Diabetes, Hypertension', 'مثلا: سكري، ضغط دم')}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Current Medications (comma-separated)', 'الأدوية الحالية (مفصولة بفاصلة)')}
                                    multiline
                                    rows={2}
                                    value={values.medications}
                                    onChange={handleChange('medications')}
                                    placeholder={label('e.g., Metformin, Aspirin', 'مثلا: ميتفورمين، أسبرين')}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={label('Last Visit', 'آخر زيارة')}
                                    type="datetime-local"
                                    value={values.lastVisit}
                                    onChange={handleChange('lastVisit')}
                                    InputLabelProps={{ shrink: true }}
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
                    </AccordionDetails>
                </Accordion>

                {/* Submit Button */}
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting}
                        size="large"
                        sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            px: 4
                        }}
                    >
                        {submitting ? label('Saving...', 'جارٍ الحفظ...') : label('Save Patient', 'حفظ المريض')}
                    </Button>
                </Stack>
            </Stack>
        </form>
    );
}