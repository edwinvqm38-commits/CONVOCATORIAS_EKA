import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { EstadoPostulacion } from '@/types';

const TONOS: Record<EstadoPostulacion, { bg: string; fg: string }> = {
  enviada: { bg: '#5C6B7424', fg: colors.neutral },
  vista: { bg: '#2E7B8C24', fg: colors.info },
  aceptada: { bg: '#237A4B24', fg: colors.success },
  rechazada: { bg: '#A6303D1F', fg: colors.danger },
};

export function Pill({ estado, label }: { estado: EstadoPostulacion; label: string }) {
  const tono = TONOS[estado];
  return (
    <View style={[styles.pill, { backgroundColor: tono.bg }]}>
      <Text style={[styles.text, { color: tono.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
