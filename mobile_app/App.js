import React from 'react';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/providers/AuthProvider';
import RootNavigator from './src/navigation/RootNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2',
    secondaryContainer: '#e3f2fd',
  },
};

export default function App() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <RootNavigator />
      </PaperProvider>
    </AuthProvider>
  );
}
