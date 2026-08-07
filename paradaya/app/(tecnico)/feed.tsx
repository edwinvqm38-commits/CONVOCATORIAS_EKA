import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { JobCard } from '@/components/JobCard';
import { ESPECIALIDADES } from '@/constants/especialidades';
import { colors, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function FeedTecnico() {
  const { paradas, tecnico } = useAppState();
  const [soloRecomendadas, setSoloRecomendadas] = useState(false);
  const [especialidadFiltro, setEspecialidadFiltro] = useState<string | null>(null);

  const paradasVigentes = useMemo(() => paradas.filter((p) => p.estado === 'vigente'), [paradas]);

  const paradasFiltradas = useMemo(() => {
    return paradasVigentes.filter((p) => {
      if (soloRecomendadas && p.especialidad !== tecnico.especialidad) return false;
      if (especialidadFiltro && p.especialidad !== especialidadFiltro) return false;
      return true;
    });
  }, [paradasVigentes, soloRecomendadas, especialidadFiltro, tecnico.especialidad]);

  return (
    <View style={styles.container}>
      <Text style={styles.saludo}>Hola, {tecnico.nombre.split(' ')[0]}</Text>
      <Text style={styles.subtitulo}>
        {tecnico.especialidad} · {tecnico.aniosExperiencia} años de experiencia
      </Text>

      <View style={styles.chips}>
        <Chip
          label="★ Recomendadas para mí"
          active={soloRecomendadas}
          onPress={() => setSoloRecomendadas((v) => !v)}
        />
        {ESPECIALIDADES.slice(0, 4).map((esp) => (
          <Chip
            key={esp}
            label={esp}
            active={especialidadFiltro === esp}
            onPress={() => setEspecialidadFiltro((prev) => (prev === esp ? null : esp))}
          />
        ))}
      </View>

      <FlatList
        data={paradasFiltradas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vacio}>No hay paradas que coincidan con este filtro por ahora.</Text>
        }
        renderItem={({ item }) => (
          <JobCard parada={item} onPress={() => router.push(`/parada/${item.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md },
  saludo: { fontSize: 18, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg },
  subtitulo: {
    fontSize: 12.5,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  lista: { padding: spacing.lg, gap: spacing.md },
  vacio: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
