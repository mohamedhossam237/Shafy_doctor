// /theme.js
import { createTheme } from '@mui/material/styles';
import { blue } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: blue[600],      // primary color (buttons, links, etc.)
      light: blue[50],      // used by chips/avatars/cards where we referenced primary.light
      dark: blue[800],
      contrastText: '#fff', // ensures readable text on primary backgrounds
    },
    background: {
      default: '#ffffff',   // whole app background is white
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#fff', color: '#111', boxShadow: 'none' }, // keep white top bar
      },
    },
  },
});

export default theme;
