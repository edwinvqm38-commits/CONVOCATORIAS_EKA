import { useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function DetalleParada() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paradas, postular, postulacionDe } = useAppState();

  const parada = useMemo(() => paradas.find((p) => p.id === id), [paradas, id]);
  const miPostulacion = parada ? postulacionDe(parada.id, 'yo') : undefined;

  if (!parada) {
    return (
      <View style={styles.container}>
        <Text>No se encontró la parada.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <Stack.Screen options={{ title: parada.titulo }} />
      <Text style={styles.titulo}>{parada.titulo}</Text>
      <Text style={styles.meta}>
        {parada.unidadMinera} · {parada.ubicacion}, Perú
      </Text>

      <View style={styles.grid}>
        <Stat label="Fechas" valor={`${parada.fechaInicio} – ${parada.fechaFin}`} />
        <Stat label="Especialidad" valor={parada.especialidad} />
        <Stat label="Cargo" valor={parada.cargo} />
        <Stat label="Vacantes" valor={String(parada.vacantes)} />
      </View>

      <Seccion titulo="Requisitos mínimos" texto={parada.requisitosMinimos} />
      <Seccion titulo="Descripción" texto={parada.descripcion} />

      <View style={{ marginTop: spacing.lg }}>
        {miPostulacion ? (
          <View style={styles.yaPostulado}>
            <Text style={styles.yaPostuladoTexto}>
              Ya postulaste a esta parada — revisa el estado en "Mis postulaciones".
            </Text>
          </View>
        ) : (
          <BotonPrimario label="Postular a esta parada" onPress={() => postular(parada.id)} />
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValor}>{valor}</Text>
    </View>
  );
}

function Seccion({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      <Text style={styles.seccionTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  titulo: { fontSize: 19, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: -8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  statValor: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 3 },
  seccion: { gap: 5 },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  seccionTexto: { fontSize: 14, color: colors.text, lineHeight: 20 },
  yaPostulado: {
    backgroundColor: '#2E7B8C1A',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  yaPostuladoTexto: { color: colors.info, fontWeight: '600', fontSize: 13, textAlign: 'center' },
});
