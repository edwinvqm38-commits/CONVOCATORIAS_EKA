import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppState } from '@/state/AppState';
import type { Rol } from '@/types';

export default function PantallaIngreso() {
  const { setRol } = useAppState();
  const [rolSeleccionado, setRolSeleccionado] = useState<Rol>('tecnico');
  const [correo, setCorreo] = useState('jcondori@correo.com');
  const [clave, setClave] = useState('');

  function ingresar() {
    setRol(rolSeleccionado);
    router.replace(rolSeleccionado === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.marca}>
          <Text style={styles.wordmark}>
            Parada<Text style={{ color: colors.accent }}>Ya</Text>
          </Text>
          <Text style={styles.tagline}>Conecta con tu próxima parada de planta</Text>
        </View>

        <View style={styles.selector}>
          <Pressable
            onPress={() => setRolSeleccionado('tecnico')}
            style={[styles.opcion, rolSeleccionado === 'tecnico' && styles.opcionActiva]}
          >
            <Text style={[styles.opcionTexto, rolSeleccionado === 'tecnico' && styles.opcionTextoActivo]}>
              Técnico / Ingeniero
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setRolSeleccionado('empresa')}
            style={[styles.opcion, rolSeleccionado === 'empresa' && styles.opcionActiva]}
          >
            <Text style={[styles.opcionTexto, rolSeleccionado === 'empresa' && styles.opcionTextoActivo]}>
              Empresa
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View style={styles.campo}>
            <Text style={styles.etiqueta}>CORREO ELECTRÓNICO</Text>
            <TextInput
              value={correo}
              onChangeText={setCorreo}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.campo}>
            <Text style={styles.etiqueta}>CONTRASEÑA</Text>
            <TextInput
              value={clave}
              onChangeText={setClave}
              style={styles.input}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>
          <BotonPrimario label="Iniciar sesión" onPress={ingresar} />
          <Text style={styles.nota}>
            Esta es una demo sin conexión a Supabase todavía — cualquier correo/contraseña te deja
            entrar como {rolSeleccionado === 'tecnico' ? 'técnico' : 'empresa'} de prueba.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  marca: { alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  wordmark: { fontSize: 34, fontWeight: '800', color: colors.brand },
  tagline: { fontSize: 13, color: colors.textMuted },
  selector: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  opcion: { flex: 1, paddingVertical: 10, borderRadius: radius.sm - 2, alignItems: 'center' },
  opcionActiva: { backgroundColor: colors.surface },
  opcionTexto: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  opcionTextoActivo: { color: colors.brand },
  form: { gap: spacing.lg },
  campo: { gap: 5 },
  etiqueta: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  nota: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },
});
