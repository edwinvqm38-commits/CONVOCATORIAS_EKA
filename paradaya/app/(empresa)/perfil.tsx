import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BotonContorno, BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';

export default function PerfilEmpresa() {
  const { empresa, setRol } = useAppState();

  function cerrarSesion() {
    setRol(null);
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.logo}>
        <Text style={styles.logoTexto}>+</Text>
      </View>
      <Text style={styles.logoNota}>Logo de la empresa (subida disponible en la Fase 3)</Text>

      <Campo etiqueta="Nombre de la empresa" valor={empresa.nombre} />
      <Campo etiqueta="RUC" valor={empresa.ruc} />
      <Campo etiqueta="Sector" valor={empresa.sector} />
      <Campo etiqueta="Descripción breve" valor={empresa.descripcion} multilinea />

      <BotonPrimario label="Guardar perfil" onPress={() => {}} />
      <View style={{ marginTop: spacing.md }}>
        <BotonContorno label="Cerrar sesión" onPress={cerrarSesion} tono={colors.neutral} />
      </View>
    </ScrollView>
  );
}

function Campo({
  etiqueta,
  valor,
  multilinea,
}: {
  etiqueta: string;
  valor: string;
  multilinea?: boolean;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <TextInput
        defaultValue={valor}
        style={[styles.input, multilinea && styles.inputAlto]}
        multiline={multilinea}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg, gap: spacing.md },
  logo: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTexto: { fontSize: 22, color: colors.textMuted },
  logoNota: {
    textAlign: 'center',
    fontSize: 11.5,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  campo: { gap: 5 },
  etiqueta: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14.5,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputAlto: { minHeight: 70, textAlignVertical: 'top' },
});
