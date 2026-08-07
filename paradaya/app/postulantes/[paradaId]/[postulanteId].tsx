import { useMemo } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotonContorno, BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function DetallePostulante() {
  const { paradaId, postulanteId } = useLocalSearchParams<{
    paradaId: string;
    postulanteId: string;
  }>();
  const { postulantes, postulaciones, actualizarEstadoPostulacion } = useAppState();

  const postulante = useMemo(
    () => postulantes.find((p) => p.id === postulanteId),
    [postulantes, postulanteId]
  );
  const postulacion = useMemo(
    () => postulaciones.find((p) => p.paradaId === paradaId && p.postulanteId === postulanteId),
    [postulaciones, paradaId, postulanteId]
  );

  if (!postulante || !postulacion) {
    return (
      <View style={styles.container}>
        <Text>No se encontró el postulante.</Text>
      </View>
    );
  }

  function decidir(estado: 'aceptada' | 'rechazada') {
    actualizarEstadoPostulacion(postulacion!.id, estado);
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <Stack.Screen options={{ title: 'Perfil del postulante' }} />

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>
            {postulante.nombre
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')}
          </Text>
        </View>
        <Text style={styles.nombre}>{postulante.nombre}</Text>
        <View style={styles.tagEspecialidad}>
          <Text style={styles.tagEspecialidadTexto}>{postulante.especialidad}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>EXPERIENCIA</Text>
          <Text style={styles.statValor}>{postulante.aniosExperiencia} años</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>UBICACIÓN</Text>
          <Text style={styles.statValor}>{postulante.ubicacion}</Text>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Experiencia previa</Text>
        {postulante.experiencia.map((exp, i) => (
          <View key={i} style={styles.expItem}>
            <Text style={styles.expCargo}>
              {exp.cargo} — {exp.lugar}
            </Text>
            <Text style={styles.expFechas}>{exp.fechas}</Text>
          </View>
        ))}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Certificaciones</Text>
        <View style={styles.tagWrap}>
          {postulante.certificaciones.map((c) => (
            <View key={c} style={styles.tag}>
              <Text style={styles.tagTexto}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.cvRow}>
        <Text style={styles.cvTexto}>📄 {postulante.cvNombre}</Text>
      </View>

      {postulacion.estado === 'aceptada' || postulacion.estado === 'rechazada' ? (
        <View style={styles.decidido}>
          <Text style={styles.decididoTexto}>
            Ya marcaste esta postulación como {postulacion.estado === 'aceptada' ? 'aceptada' : 'rechazada'}.
          </Text>
        </View>
      ) : (
        <View style={styles.botones}>
          <View style={{ flex: 1 }}>
            <BotonContorno label="Rechazar" onPress={() => decidir('rechazada')} tono={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <BotonPrimario label="Aceptar" onPress={() => decidir('aceptada')} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: '#fff', fontWeight: '700', fontSize: 20 },
  nombre: { fontSize: 17, fontWeight: '700', color: colors.text },
  tagEspecialidad: {
    backgroundColor: '#D9541F1A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagEspecialidadTexto: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  statValor: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 3 },
  seccion: { gap: spacing.sm },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  expItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  expCargo: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  expFechas: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagTexto: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cvRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  cvTexto: { fontSize: 13, fontWeight: '600', color: colors.brand },
  botones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  decidido: {
    backgroundColor: '#2E7B8C1A',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  decididoTexto: { color: colors.info, fontWeight: '600', fontSize: 13, textAlign: 'center' },
});
