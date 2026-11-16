import { createTheme } from '@mui/material/styles'

// Maroon (primary), light grey (background), charcoal / "light black" (text, sidebar)
export const theme = createTheme({
  palette: {
    primary: { main: '#7A1F2B', dark: '#5C1620', light: '#A34A56', contrastText: '#FFFFFF' },
    secondary: { main: '#2A2A2E', contrastText: '#FFFFFF' },
    background: { default: '#F3F3F2', paper: '#FFFFFF' },
    text: { primary: '#2A2A2E', secondary: '#5B5B61' },
    divider: '#E1E1DF',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #E1E1DF', boxShadow: 'none' } } },
  },
})
