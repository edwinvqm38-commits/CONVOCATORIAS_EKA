import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BotonContorno, BotonPrimario } from '@/components/Buttons';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { cerrarSesion as cerrarSesionSupabase } from '@/services/auth';
import { useAppState } from '@/state/AppState';

interface PerfilTecnicoReal {
  id: string;
  nombres_completos: string;
  telefono: string | null;
  correo_contacto: string | null;
}

export default function PerfilTecnico() {
  const { tecnico, setRol } = useAppState();

  const [perfilReal, setPerfilReal] = useState<PerfilTecnicoReal | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(supabaseConfigurado);
  const [nombresInput, setNombresInput] = useState('');
  const [telefonoInput, setTelefonoInput] = useState('');
  const [correoInput, setCorreoInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setCargandoPerfil(false);
        return;
      }
      const { data } = await supabase
        .from('paradaya_tecnicos')
        .select('id, nombres_completos, telefono, correo_contacto')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (data) {
        setPerfilReal(data);
        setNombresInput(data.nombres_completos ?? '');
        setTelefonoInput(data.telefono ?? '');
        setCorreoInput(data.correo_contacto ?? '');
      }
      setCargandoPerfil(false);
    })();
  }, []);

  async function guardarDatos() {
    if (!perfilReal) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { error } = await supabase
        .from('paradaya_tecnicos')
        .update({
          nombres_completos: nombresInput,
          telefono: telefonoInput || null,
          correo_contacto: correoInput || null,
        })
        .eq('id', perfilReal.id);
      if (error) throw error;
      setMensaje('Guardado.');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarSesion() {
    await cerrarSesionSupabase();
    setRol(null);
    router.replace('/');
  }

  if (cargandoPerfil) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Modo real: hay sesión de Supabase y ya existe la fila del técnico.
  // Experiencia, certificaciones y CV todavía no están conectados a datos
  // reales (llegan en la Fase 3) — por ahora solo se edita lo básico.
  if (supabaseConfigurado && perfilReal) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Mis datos de contacto</Text>
          <Campo etiqueta="Nombres completos" valor={nombresInput} onCambiar={setNombresInput} />
          <Campo etiqueta="Teléfono" valor={telefonoInput} onCambiar={setTelefonoInput} />
          <Campo
            etiqueta="Correo (para que las empresas te escriban)"
            valor={correoInput}
            onCambiar={setCorreoInput}
            teclado="email-address"
          />
          {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}
          <BotonPrimario label={guardando ? 'Guardando…' : 'Guardar'} onPress={guardarDatos} disabled={guardando} />
        </View>

        <Text style={styles.notaFase}>
          Especialidades, experiencia previa, certificaciones y CV se agregan a tu perfil en la
          próxima fase.
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <BotonContorno label="Cerrar sesión" onPress={cerrarSesion} tono={colors.neutral} />
        </View>
      </ScrollView>
    );
  }

  // Modo demo: sin sesión real, se muestra el perfil de ejemplo completo.
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

function Campo({
  etiqueta,
  valor,
  onCambiar,
  teclado,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  teclado?: 'default' | 'email-address';
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        style={styles.input}
        keyboardType={teclado ?? 'default'}
        autoCapitalize={teclado === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centrado: { alignItems: 'center', justifyContent: 'center' },
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
  mensaje: { fontSize: 12.5, color: colors.info, textAlign: 'center' },
  notaFase: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
