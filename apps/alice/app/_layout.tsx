import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { palette } from '@/constants/theme';
import { BootstrapProvider } from '@/providers/BootstrapProvider';
import { GuideProvider } from '@/providers/GuideProvider';

export { ErrorBoundary } from 'expo-router';

const aliceNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.brand,
    background: palette.white,
    card: palette.white,
    text: palette.navy,
    border: palette.border,
  },
};

export default function RootLayout() {
  return (
    <GuideProvider>
      <BootstrapProvider>
        <ThemeProvider value={aliceNavigationTheme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.white } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="complete" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="daily" />
            <Stack.Screen name="tarot/[mode]" />
          </Stack>
        </ThemeProvider>
      </BootstrapProvider>
    </GuideProvider>
  );
}
