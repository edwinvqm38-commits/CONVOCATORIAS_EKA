import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotonContorno, BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import {
  completarRegistroEmpresa,
  completarRegistroTecnico,
  iniciarSesionConCorreo,
  iniciarSesionConGoogle,
  obtenerDatosSesionActual,
  obtenerRolActual,
  registrarEmpresa,
  registrarTecnico,
} from '@/services/auth';
import { useAppState } from '@/state/AppState';
import type { Rol } from '@/types';

type ModoCorreo = 'ingresar' | 'crear';

export default function PantallaIngreso() {
  const { setRol } = useAppState();
  const [modoCorreo, setModoCorreo] = useState<ModoCorreo>('ingresar');
  const [rolSeleccionado, setRolSeleccionado] = useState<Rol>('tecnico');
  const [completandoPerfil, setCompletandoPerfil] = useState(false);

  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombresCompletos, setNombresCompletos] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
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
        entrarComo(rolActual);
      } else {
        setRevisandoSesion(false);
      }
    });
  }, []);

  function entrarComo(rol: Rol) {
    setRol(rol);
    router.replace(rol === 'tecnico' ? '/(tecnico)/feed' : '/(empresa)/paradas');
  }

  async function enviarPorCorreo() {
    setError(null);
    setCargando(true);
    try {
      if (modoCorreo === 'ingresar') {
        await iniciarSesionConCorreo(correo, clave);
      } else if (rolSeleccionado === 'tecnico') {
        await registrarTecnico(correo, clave, nombresCompletos);
      } else {
        await registrarEmpresa(correo, clave, nombreEmpresa, ruc);
      }
      const rolActual = (await obtenerRolActual()) ?? rolSeleccionado;
      entrarComo(rolActual);
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
      if (rolActual) {
        entrarComo(rolActual);
        return;
      }
      // Primera vez con esta cuenta de Google: pedimos los datos mínimos
      // antes de dejarlo pasar. Prellenamos lo que Google ya nos dio.
      const datos = await obtenerDatosSesionActual();
      if (datos.correo) setCorreoContacto(datos.correo);
      if (datos.nombre) setNombresCompletos(datos.nombre);
      setCompletandoPerfil(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  async function terminarRegistro() {
    setError(null);
    setCargando(true);
    try {
      if (rolSeleccionado === 'tecnico') {
        await completarRegistroTecnico(nombresCompletos, correoContacto);
      } else {
        await completarRegistroEmpresa(nombreEmpresa, ruc);
      }
      entrarComo(rolSeleccionado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo terminar el registro.');
    } finally {
      setCargando(false);
    }
  }

  function explorarModoDemo() {
    entrarComo(rolSeleccionado);
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

        {completandoPerfil ? (
          <View style={styles.form}>
            <Text style={styles.notaPaso}>Primera vez por aquí — cuéntanos quién eres.</Text>
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

            {rolSeleccionado === 'tecnico' ? (
              <>
                <Campo etiqueta="Nombres completos" valor={nombresCompletos} onCambiar={setNombresCompletos} />
                <Campo
                  etiqueta="Correo de contacto"
                  valor={correoContacto}
                  onCambiar={setCorreoContacto}
                  teclado="email-address"
                  autoCapitalizar="none"
                />
              </>
            ) : (
              <>
                <Campo etiqueta="Nombre de la empresa" valor={nombreEmpresa} onCambiar={setNombreEmpresa} />
                <Campo etiqueta="RUC" valor={ruc} onCambiar={setRuc} teclado="number-pad" />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            <BotonPrimario
              label={cargando ? 'Un momento…' : 'Terminar registro'}
              onPress={terminarRegistro}
              disabled={cargando}
            />
          </View>
        ) : (
          <>
            <View style={styles.form}>
              <BotonContorno label="Continuar con Google" onPress={conGoogle} tono={colors.brand} />
            </View>

            <View style={styles.divisor}>
              <View style={styles.linea} />
              <Text style={styles.divisorTexto}>o con tu correo</Text>
              <View style={styles.linea} />
            </View>

            <View style={styles.form}>
              <View style={styles.selectorModo}>
                <Pressable
                  onPress={() => setModoCorreo('ingresar')}
                  style={[styles.opcion, modoCorreo === 'ingresar' && styles.opcionActiva]}
                >
                  <Text style={[styles.opcionTexto, modoCorreo === 'ingresar' && styles.opcionTextoActivo]}>
                    Iniciar sesión
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setModoCorreo('crear')}
                  style={[styles.opcion, modoCorreo === 'crear' && styles.opcionActiva]}
                >
                  <Text style={[styles.opcionTexto, modoCorreo === 'crear' && styles.opcionTextoActivo]}>
                    Crear cuenta
                  </Text>
                </Pressable>
              </View>

              {modoCorreo === 'crear' && (
                <View style={styles.selector}>
                  <Pressable
                    onPress={() => setRolSeleccionado('tecnico')}
                    style={[styles.opcion, rolSeleccionado === 'tecnico' && styles.opcionActiva]}
                  >
                    <Text
                      style={[styles.opcionTexto, rolSeleccionado === 'tecnico' && styles.opcionTextoActivo]}
                    >
                      Técnico / Ingeniero
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRolSeleccionado('empresa')}
                    style={[styles.opcion, rolSeleccionado === 'empresa' && styles.opcionActiva]}
                  >
                    <Text
                      style={[styles.opcionTexto, rolSeleccionado === 'empresa' && styles.opcionTextoActivo]}
                    >
                      Empresa
                    </Text>
                  </Pressable>
                </View>
              )}

              {modoCorreo === 'crear' && rolSeleccionado === 'tecnico' && (
                <Campo etiqueta="Nombres completos" valor={nombresCompletos} onCambiar={setNombresCompletos} />
              )}
              {modoCorreo === 'crear' && rolSeleccionado === 'empresa' && (
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
                label={cargando ? 'Un momento…' : modoCorreo === 'ingresar' ? 'Iniciar sesión' : 'Crear cuenta'}
                onPress={enviarPorCorreo}
                disabled={cargando}
              />
            </View>
          </>
        )}

        <Pressable onPress={explorarModoDemo} style={styles.linkDemo}>
          <Text style={styles.linkDemoTexto}>Explorar con datos de ejemplo (sin cuenta) →</Text>
        </Pressable>
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
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  oculta?: boolean;
  teclado?: 'default' | 'email-address' | 'number-pad';
  autoCapitalizar?: 'none' | 'sentences';
  placeholder?: string;
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
        placeholder={placeholder ?? (oculta ? '••••••••' : undefined)}
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
  divisor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linea: { flex: 1, height: 1, backgroundColor: colors.border },
  divisorTexto: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
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
  notaPaso: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
  error: { fontSize: 12.5, color: colors.danger, textAlign: 'center' },
  linkDemo: { alignItems: 'center', paddingVertical: spacing.sm },
  linkDemoTexto: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
});
