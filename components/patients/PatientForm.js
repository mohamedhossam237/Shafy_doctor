'use client';
import * as React from 'react';
import { Grid, TextField, MenuItem, Stack, Button } from '@mui/material';


export default function PatientForm({ isArabic, initialValues, onSubmit }) {
const [values, setValues] = React.useState(
initialValues || { name: '', age: '', gender: '', lastVisit: '' }
);
const [submitting, setSubmitting] = React.useState(false);


const handleChange = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));


const submit = async (e) => {
e.preventDefault();
setSubmitting(true);
await onSubmit?.(values, { setSubmitting });
};


return (
<form onSubmit={submit}>
<Grid container spacing={2}>
<Grid item xs={12}>
<TextField fullWidth label={isArabic ? 'اسم المريض' : 'Patient Name'} value={values.name} onChange={handleChange('name')} required />
</Grid>
<Grid item xs={12} sm={6}>
<TextField fullWidth label={isArabic ? 'العمر' : 'Age'} type="number" value={values.age} onChange={handleChange('age')} />
</Grid>
<Grid item xs={12} sm={6}>
<TextField fullWidth select label={isArabic ? 'النوع' : 'Gender'} value={values.gender} onChange={handleChange('gender')}>
<MenuItem value="male">{isArabic ? 'ذكر' : 'Male'}</MenuItem>
<MenuItem value="female">{isArabic ? 'أنثى' : 'Female'}</MenuItem>
<MenuItem value="other">{isArabic ? 'آخر' : 'Other'}</MenuItem>
</TextField>
</Grid>
<Grid item xs={12}>
<TextField
fullWidth
label={isArabic ? 'آخر زيارة' : 'Last Visit'}
type="datetime-local"
value={values.lastVisit}
onChange={handleChange('lastVisit')}
InputLabelProps={{ shrink: true }}
/>
</Grid>
<Grid item xs={12}>
<Stack direction="row" spacing={1} justifyContent="flex-end">
<Button type="submit" variant="contained" disabled={submitting}>
{isArabic ? 'حفظ' : 'Save'}
</Button>
</Stack>
</Grid>
</Grid>
</form>
);
}