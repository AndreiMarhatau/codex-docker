import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import App from './App.jsx';
import createAppTheme from './theme.js';
import './styles.css';

const ThemeBridge = () => {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createAppTheme(prefersDark ? 'dark' : 'light'), [prefersDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeBridge />
  </React.StrictMode>
);
