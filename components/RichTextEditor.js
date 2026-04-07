'use client';

import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { Box, useTheme, alpha } from '@mui/material';

// Dynamic import to avoid SSR issues with react-quill
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align'
];

export default function RichTextEditor({ value, onChange, placeholder, dir = 'ltr', error, helperText, disabled }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        '& .quill': {
          border: '1px solid',
          borderColor: error ? 'error.main' : 'rgba(0, 0, 0, 0.23)', // Match MUI OutlinedInput border
          borderRadius: 1,
          transition: 'border-color 0.2s',
          '&:hover': {
            borderColor: disabled ? undefined : 'text.primary',
          },
          '&:focus-within': {
            borderColor: disabled ? undefined : 'primary.main',
            borderWidth: 2,
            mx: -0.125, // Compensate for border width change to avoid layout shift
            px: 0.125,
            my: -0.125,
            py: 0.125,
          },
          backgroundColor: disabled ? 'action.disabledBackground' : 'transparent',
          color: disabled ? 'text.disabled' : 'text.primary',
        },
        '& .ql-toolbar': {
          border: 'none',
          borderBottom: '1px solid',
          borderColor: 'inherit',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          backgroundColor: alpha(theme.palette.background.paper, 0.5),
          direction: 'ltr', // Toolbar always LTR
        },
        '& .ql-container': {
          border: 'none',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          minHeight: '120px',
          fontSize: '1rem',
          fontFamily: theme.typography.fontFamily,
        },
        '& .ql-editor': {
          direction: dir,
          textAlign: dir === 'rtl' ? 'right' : 'left',
          minHeight: '120px',
          '&.ql-blank::before': {
            right: dir === 'rtl' ? '15px' : 'auto',
            left: dir === 'rtl' ? 'auto' : '15px',
            fontStyle: 'normal',
            color: 'text.secondary',
            opacity: 0.6,
          }
        },
        // Helper text styling
        ...(helperText && {
          mb: 3, // Add space for helper text
          position: 'relative',
          '&::after': {
            content: `"${helperText}"`,
            position: 'absolute',
            bottom: -20,
            left: dir === 'rtl' ? 'auto' : 14,
            right: dir === 'rtl' ? 14 : 'auto',
            fontSize: '0.75rem',
            color: error ? 'error.main' : 'text.secondary',
            fontFamily: theme.typography.fontFamily,
          }
        })
      }}
    >
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
      />
    </Box>
  );
}
