import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function MisParadas() {
  const { paradas, postulaciones, empresa } = useAppState();
  const misParadas = paradas.filter((p) => p.empresaId === empresa.id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitulo}>{empresa.nombre}</Text>
        <Pressable
          style={styles.botonNueva}
          onPress={() =>
            Alert.alert(
              'Publicar parada',
              'El formulario para publicar una parada nueva llega en la Fase 4 del plan.'
            )
          }
        >
          <Text style={styles.botonNuevaTexto}>+ Nueva</Text>
        </Pressable>
      </View>

      <FlatList
        data={misParadas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          const cantidad = postulaciones.filter((p) => p.paradaId === item.id).length;
          return (
            <JobCard
              parada={item}
              onPress={() => router.push(`/postulantes/${item.id}`)}
              extra={
                <>
                  <View
                    style={[
                      styles.estadoTag,
                      { backgroundColor: item.estado === 'vigente' ? '#237A4B24' : '#5C6B7424' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: item.estado === 'vigente' ? colors.success : colors.neutral,
                      }}
                    >
                      {item.estado === 'vigente' ? 'Vigente' : 'Cerrada'}
                    </Text>
                  </View>
                  <View style={styles.estadoTag}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                      {cantidad} postulante{cantidad === 1 ? '' : 's'}
                    </Text>
                  </View>
                </>
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  subtitulo: { fontSize: 13, color: colors.textMuted, fontWeight: '600', flexShrink: 1 },
  botonNueva: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  botonNuevaTexto: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },
  lista: { padding: spacing.lg, gap: spacing.md },
  estadoTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.bg,
  },
});
