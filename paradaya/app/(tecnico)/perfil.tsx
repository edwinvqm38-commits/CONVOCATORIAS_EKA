import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BotonContorno } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { cerrarSesion as cerrarSesionSupabase } from '@/services/auth';
import { useAppState } from '@/state/AppState';

export default function PerfilTecnico() {
  const { tecnico, setRol } = useAppState();

  async function cerrarSesion() {
    await cerrarSesionSupabase();
    setRol(null);
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>
            {tecnico.nombre
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')}
          </Text>
        </View>
        <Text style={styles.nombre}>{tecnico.nombre}</Text>
        <View style={styles.tagEspecialidad}>
          <Text style={styles.tagEspecialidadTexto}>{tecnico.especialidad}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>EXPERIENCIA</Text>
          <Text style={styles.statValor}>{tecnico.aniosExperiencia} años</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>UBICACIÓN</Text>
          <Text style={styles.statValor}>{tecnico.ubicacion}</Text>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Experiencia previa</Text>
        {tecnico.experiencia.map((exp, i) => (
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
          {tecnico.certificaciones.map((c) => (
            <View key={c} style={styles.tag}>
              <Text style={styles.tagTexto}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.cvRow}>
        <Text style={styles.cvTexto}>📄 {tecnico.cvNombre}</Text>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <BotonContorno label="Cerrar sesión" onPress={cerrarSesion} tono={colors.neutral} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', gap: 6, paddingVertical: spacing.md },
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
});
