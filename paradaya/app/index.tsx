import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonContorno, BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import {
  iniciarSesionConCorreo,
  iniciarSesionConGoogle,
  obtenerRolActual,
  registrarEmpresa,
  registrarTecnico,
} from '@/services/auth';
import { useAppState } from '@/state/AppState';
import type { Rol } from '@/types';

type Modo = 'ingresar' | 'crear';

export default function PantallaIngreso() {
  const { setRol } = useAppState();
  const [modo, setModo] = useState<Modo>('ingresar');
  const [rolSeleccionado, setRolSeleccionado] = useState<Rol>('tecnico');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombresCompletos, setNombresCompletos] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [ruc, setRuc] = useState('');
  const [cargando, setCargando] = useState(false);
  const [revisandoSesion, setRevisandoSesion] = useState(supabaseConfigurado);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay una sesión de Supabase activa (el usuario no cerró sesión la
  // última vez), lo mandamos directo a su feed en vez de mostrarle el login.
  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setRevisandoSesion(false);
        return;
      }
      const rolActual = await obtenerRolActual();
      if (rolActual) {
        setRol(rolActual);
        router.replace(rolActual === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
      } else {
        setRevisandoSesion(false);
      }
    });
  }, []);

  async function enviar() {
    setError(null);
    setCargando(true);
    try {
      if (modo === 'ingresar') {
        await iniciarSesionConCorreo(correo, clave);
      } else if (rolSeleccionado === 'tecnico') {
        await registrarTecnico(correo, clave, nombresCompletos);
      } else {
        await registrarEmpresa(correo, clave, nombreEmpresa, ruc);
      }
      const rolActual = (await obtenerRolActual()) ?? rolSeleccionado;
      setRol(rolActual);
      router.replace(rolActual === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  async function conGoogle() {
    setError(null);
    setCargando(true);
    try {
      await iniciarSesionConGoogle();
      const rolActual = await obtenerRolActual();
      if (!rolActual) {
        throw new Error(
          'Tu cuenta de Google no tiene perfil todavía — por ahora crea la cuenta con correo y contraseña.'
        );
      }
      setRol(rolActual);
      router.replace(rolActual === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  function explorarModoDemo() {
    setRol(rolSeleccionado);
    router.replace(rolSeleccionado === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
  }

  if (revisandoSesion) {
    return (
      <SafeAreaView style={[styles.safe, styles.centrado]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.marca}>
          <Text style={styles.wordmark}>
            Parada<Text style={{ color: colors.accent }}>Ya</Text>
          </Text>
          <Text style={styles.tagline}>Conecta con tu próxima parada de planta</Text>
        </View>

        {!supabaseConfigurado && (
          <View style={styles.avisoDemo}>
            <Text style={styles.avisoDemoTexto}>
              El backend (Supabase) todavía no está conectado en esta build. Puedes explorar la app
              con datos de ejemplo abajo, sin crear cuenta.
            </Text>
          </View>
        )}

        <View style={styles.selectorModo}>
          <Pressable
            onPress={() => setModo('ingresar')}
            style={[styles.opcion, modo === 'ingresar' && styles.opcionActiva]}
          >
            <Text style={[styles.opcionTexto, modo === 'ingresar' && styles.opcionTextoActivo]}>
              Iniciar sesión
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setModo('crear')}
            style={[styles.opcion, modo === 'crear' && styles.opcionActiva]}
          >
            <Text style={[styles.opcionTexto, modo === 'crear' && styles.opcionTextoActivo]}>
              Crear cuenta
            </Text>
          </Pressable>
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
          {modo === 'crear' && rolSeleccionado === 'tecnico' && (
            <Campo etiqueta="Nombres completos" valor={nombresCompletos} onCambiar={setNombresCompletos} />
          )}
          {modo === 'crear' && rolSeleccionado === 'empresa' && (
            <>
              <Campo etiqueta="Nombre de la empresa" valor={nombreEmpresa} onCambiar={setNombreEmpresa} />
              <Campo etiqueta="RUC" valor={ruc} onCambiar={setRuc} teclado="number-pad" />
            </>
          )}
          <Campo
            etiqueta="Correo electrónico"
            valor={correo}
            onCambiar={setCorreo}
            teclado="email-address"
            autoCapitalizar="none"
          />
          <Campo etiqueta="Contraseña" valor={clave} onCambiar={setClave} oculta />

          {error && <Text style={styles.error}>{error}</Text>}

          <BotonPrimario
            label={cargando ? 'Un momento…' : modo === 'ingresar' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={enviar}
            disabled={cargando}
          />
          <BotonContorno label="Continuar con Google" onPress={conGoogle} tono={colors.brand} />

          <Pressable onPress={explorarModoDemo} style={styles.linkDemo}>
            <Text style={styles.linkDemoTexto}>Explorar con datos de ejemplo (sin cuenta) →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Campo({
  etiqueta,
  valor,
  onCambiar,
  oculta,
  teclado,
  autoCapitalizar,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  oculta?: boolean;
  teclado?: 'default' | 'email-address' | 'number-pad';
  autoCapitalizar?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        style={styles.input}
        secureTextEntry={oculta}
        keyboardType={teclado ?? 'default'}
        autoCapitalize={autoCapitalizar ?? 'sentences'}
        placeholder={oculta ? '••••••••' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  marca: { alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  wordmark: { fontSize: 34, fontWeight: '800', color: colors.brand },
  tagline: { fontSize: 13, color: colors.textMuted },
  avisoDemo: {
    backgroundColor: '#2E7B8C14',
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  avisoDemoTexto: { fontSize: 12, color: colors.info, lineHeight: 17 },
  selectorModo: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
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
  form: { gap: spacing.md },
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
  error: { fontSize: 12.5, color: colors.danger, textAlign: 'center' },
  linkDemo: { alignItems: 'center', paddingVertical: spacing.sm },
  linkDemoTexto: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
});
