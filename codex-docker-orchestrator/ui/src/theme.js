import { createTheme } from '@mui/material/styles';

const createAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#7aa2f7' : '#1f4b99'
      },
      secondary: {
        main: isDark ? '#f59e0b' : '#d97706'
      },
      background: {
        default: isDark ? '#0b1120' : '#f4f2ee',
        paper: isDark ? '#121a2c' : '#ffffff'
      },
      text: {
        primary: isDark ? '#f8fafc' : '#1b1d1f',
        secondary: isDark ? '#b6c0d1' : '#4d5662'
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
            border: isDark
              ? '1px solid rgba(148, 163, 184, 0.16)'
              : '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: isDark
              ? '0 18px 45px rgba(8, 12, 24, 0.65)'
              : '0 18px 45px rgba(15, 23, 42, 0.06)'
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
};

export default createAppTheme;
