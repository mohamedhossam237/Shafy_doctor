// /theme.js
import { createTheme, alpha } from '@mui/material/styles';

const FONT_STACK = "'Cairo', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#eff6ff',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0ea5e9',
      light: '#e0f2fe',
      dark: '#0369a1',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#dcfce7',
      dark: '#047857',
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#b45309',
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#b91c1c',
    },
    info: {
      main: '#6366f1',
      light: '#e0e7ff',
      dark: '#4338ca',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: '#94a3b8',
    },
    divider: 'rgba(226, 232, 240, 0.85)',
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: FONT_STACK,
    h1: { fontWeight: 900, letterSpacing: '-0.02em' },
    h2: { fontWeight: 900, letterSpacing: '-0.02em' },
    h3: { fontWeight: 900, letterSpacing: '-0.015em' },
    h4: { fontWeight: 800, letterSpacing: '-0.01em' },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: FONT_STACK,
          backgroundColor: '#f4f7fb',
          color: '#0f172a',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: '#0f172a',
          boxShadow: '0 1px 0 rgba(226, 232, 240, 0.8)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 20,
        },
        elevation1: {
          border: '1px solid rgba(226, 232, 240, 0.85)',
          boxShadow: '0 10px 28px -8px rgba(37, 99, 235, 0.08), 0 4px 12px -4px rgba(15, 23, 42, 0.04)',
        },
        elevation2: {
          border: '1px solid rgba(226, 232, 240, 0.85)',
          boxShadow: '0 14px 32px -8px rgba(37, 99, 235, 0.12), 0 6px 14px -4px rgba(15, 23, 42, 0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: '1px solid rgba(226, 232, 240, 0.85)',
          boxShadow: '0 10px 28px -8px rgba(37, 99, 235, 0.07), 0 4px 10px -4px rgba(15, 23, 42, 0.04)',
          transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease, border-color 0.22s ease',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 700,
          textTransform: 'none',
          transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: '0 6px 18px -4px rgba(37, 99, 235, 0.42)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
            boxShadow: '0 10px 24px -4px rgba(37, 99, 235, 0.52)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: 'rgba(203, 213, 225, 0.9)',
          '&:hover': {
            borderColor: '#2563eb',
            backgroundColor: alpha('#2563eb', 0.04),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderRadius: 10,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#ffffff',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
            borderWidth: '1.5px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#93c5fd',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#2563eb',
            borderWidth: '1.5px',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.14)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.22)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.14)',
        },
      },
    },
  },
});

export default theme;
