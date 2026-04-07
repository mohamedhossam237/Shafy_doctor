import { AuthProvider } from './src/providers/AuthProvider';

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
