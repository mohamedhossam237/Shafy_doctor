import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2',
    secondary: '#42a5f5',
    accent: '#03a9f4',
    background: '#F5F7FA', // Light grey background for a modern feel
    surface: '#ffffff',
    error: '#d32f2f',
    warning: '#ed6c02',
    success: '#2e7d32',
    info: '#0288d1',
    // Custom colors for gradients
    gradientStart: '#1976d2',
    gradientEnd: '#42a5f5',
  },
};

export const globalStyles = {
  card: {
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
};
