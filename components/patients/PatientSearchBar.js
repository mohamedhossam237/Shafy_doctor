'use client';
import * as React from 'react';
import { Stack, TextField, InputAdornment, IconButton, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';


export default function PatientSearchBar({ isArabic, value, onChange, onAddNew }) {
const [local, setLocal] = React.useState(value || '');


React.useEffect(() => setLocal(value || ''), [value]);


// debounce typing
React.useEffect(() => {
const id = setTimeout(() => onChange?.(local), 250);
return () => clearTimeout(id);
}, [local]);


return (
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
<TextField
fullWidth
value={local}
onChange={(e) => setLocal(e.target.value)}
placeholder={isArabic ? 'ابحث عن مريض...' : 'Search patient...'}
InputProps={{
startAdornment: (
<InputAdornment position="start">
<SearchIcon />
</InputAdornment>
),
endAdornment: local ? (
<InputAdornment position="end">
<IconButton onClick={() => setLocal('')} size="small"><ClearIcon /></IconButton>
</InputAdornment>
) : null,
}}
/>
</Stack>
);
}