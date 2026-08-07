import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/Pill';
import { ESTADO_LABEL } from '@/data/mock';
import { colors, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function MisPostulaciones() {
  const { postulaciones, paradas } = useAppState();

  const misPostulaciones = useMemo(
    () => postulaciones.filter((p) => p.postulanteId === 'yo'),
    [postulaciones]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={misPostulaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vacio}>Todavía no postulaste a ninguna parada.</Text>
        }
        renderItem={({ item }) => {
          const parada = paradas.find((p) => p.id === item.paradaId);
          if (!parada) return null;
          return (
            <View style={styles.item}>
              <View style={styles.info}>
                <Text style={styles.titulo}>{parada.titulo}</Text>
                <Text style={styles.meta}>{parada.unidadMinera}</Text>
              </View>
              <Pill estado={item.estado} label={ESTADO_LABEL[item.estado]} />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: spacing.lg, gap: spacing.md },
  vacio: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  info: { flex: 1 },
  titulo: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
