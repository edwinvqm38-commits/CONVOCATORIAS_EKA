import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface BotonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function BotonPrimario({ label, onPress, disabled }: BotonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primario, disabled && styles.deshabilitado]}
      accessibilityRole="button"
    >
      <Text style={styles.textoPrimario}>{label}</Text>
    </Pressable>
  );
}

export function BotonContorno({
  label,
  onPress,
  tono = colors.danger,
}: BotonProps & { tono?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.contorno, { borderColor: tono }]}
      accessibilityRole="button"
    >
      <Text style={[styles.textoContorno, { color: tono }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primario: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  deshabilitado: {
    opacity: 0.5,
  },
  textoPrimario: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  contorno: {
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  textoContorno: {
    fontWeight: '700',
    fontSize: 15,
  },
});
