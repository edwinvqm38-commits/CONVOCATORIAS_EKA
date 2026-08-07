import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Parada } from '@/types';

export function JobCard({
  parada,
  onPress,
  extra,
}: {
  parada: Parada;
  onPress?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <Text style={styles.titulo}>{parada.titulo}</Text>
      <Text style={styles.meta}>
        {parada.unidadMinera} · {parada.ubicacion}
      </Text>
      <Text style={styles.fechas}>
        {parada.fechaInicio} – {parada.fechaFin}
      </Text>
      <View style={styles.tags}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{parada.especialidad}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{parada.cargo}</Text>
        </View>
        {extra}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: 3,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  fechas: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginBottom: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
