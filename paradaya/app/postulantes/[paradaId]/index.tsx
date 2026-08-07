import { useMemo } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/Pill';
import { colors, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

// La empresa ve "Nuevo" en vez de "Enviada" para las postulaciones que
// todavía no abrió — mismo estado guardado, distinta etiqueta según quién mira.
function etiquetaParaEmpresa(estado: string) {
  if (estado === 'enviada') return 'Nuevo';
  if (estado === 'vista') return 'Vista';
  if (estado === 'aceptada') return 'Aceptado';
  return 'Rechazado';
}

export default function ListaPostulantes() {
  const { paradaId } = useLocalSearchParams<{ paradaId: string }>();
  const { paradas, postulaciones, postulantes } = useAppState();

  const parada = paradas.find((p) => p.id === paradaId);
  const items = useMemo(
    () => postulaciones.filter((p) => p.paradaId === paradaId),
    [postulaciones, paradaId]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Postulantes' }} />
      {parada && <Text style={styles.subtitulo}>{parada.titulo}</Text>}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Text style={styles.vacio}>Todavía no hay postulantes para esta parada.</Text>
        }
        renderItem={({ item }) => {
          const postulante = postulantes.find((p) => p.id === item.postulanteId);
          if (!postulante) return null;
          return (
            <Pressable
              style={styles.item}
              onPress={() => router.push(`/postulantes/${paradaId}/${postulante.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarTexto}>
                  {postulante.nombre
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{postulante.nombre}</Text>
                <Text style={styles.meta}>
                  {postulante.especialidad} · {postulante.aniosExperiencia} años exp.
                </Text>
              </View>
              <Pill estado={item.estado} label={etiquetaParaEmpresa(item.estado)} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitulo: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  lista: { padding: spacing.lg, gap: spacing.md },
  vacio: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  info: { flex: 1 },
  nombre: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
});
