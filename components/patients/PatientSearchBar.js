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
    }, [local, onChange]);


    return (
        <TextField
            fullWidth
            size="medium"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={isArabic ? 'ابحث عن مريض بالاسم أو رقم الهاتف...' : 'Search patient by name or phone...'}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon />
                    </InputAdornment>
                ),
                endAdornment: local ? (
                    <InputAdornment position="end">
                        <IconButton onClick={() => setLocal('')} size="small">
                            <ClearIcon />
                        </IconButton>
                    </InputAdornment>
                ) : null,
            }}
            sx={{
                '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                },
            }}
        />
    );
}