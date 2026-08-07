import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { AppStateProvider } from '@/state/AppState';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tecnico)" options={{ headerShown: false }} />
        <Stack.Screen name="(empresa)" options={{ headerShown: false }} />
        <Stack.Screen name="parada/[id]" options={{ title: 'Detalle de la parada' }} />
        <Stack.Screen name="postulantes/[paradaId]/index" options={{ title: 'Postulantes' }} />
        <Stack.Screen
          name="postulantes/[paradaId]/[postulanteId]"
          options={{ title: 'Perfil del postulante' }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'No encontrado' }} />
      </Stack>
    </AppStateProvider>
  );
}
