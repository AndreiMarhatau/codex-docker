import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1f4b99'
    },
    secondary: {
      main: '#d97706'
    },
    background: {
      default: '#f4f2ee',
      paper: '#ffffff'
    },
    text: {
      primary: '#1b1d1f',
      secondary: '#4d5662'
    }
  },
  typography: {
    fontFamily: '"Space Grotesk", "IBM Plex Mono", sans-serif',
    h4: {
      fontWeight: 600
    },
    h6: {
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 16
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600
        }
      }
    }
  }
});

export default theme;
