import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';
import type { Rol } from '@/types';

WebBrowser.maybeCompleteAuthSession();

export async function registrarTecnico(correo: string, clave: string, nombresCompletos: string) {
  const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
  if (error) throw error;
  if (!data.user) throw new Error('No se pudo crear la cuenta.');

  const { error: perfilError } = await supabase
    .from('paradaya_tecnicos')
    .insert({ user_id: data.user.id, nombres_completos: nombresCompletos });
  if (perfilError) throw perfilError;
}

export async function registrarEmpresa(correo: string, clave: string, nombre: string, ruc: string) {
  const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
  if (error) throw error;
  if (!data.user) throw new Error('No se pudo crear la cuenta.');

  const { error: perfilError } = await supabase
    .from('paradaya_empresas')
    .insert({ user_id: data.user.id, nombre, ruc });
  if (perfilError) throw perfilError;
}

export async function iniciarSesionConCorreo(correo: string, clave: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw error;
}

// Requiere que Google esté configurado como proveedor en el panel de
// Supabase (Authentication → Providers → Google) — ver README, sección 10.
export async function iniciarSesionConGoogle() {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase no devolvió una URL de autenticación.');

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultado.type !== 'success' || !resultado.url) {
    throw new Error('Se canceló el ingreso con Google.');
  }

  const params = extraerParametrosDeHash(resultado.url);
  if (params.error) throw new Error(params.error_description ?? params.error);
  if (!params.access_token || !params.refresh_token) {
    throw new Error('La respuesta de Google no incluyó una sesión válida.');
  }

  const { error: sesionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sesionError) throw sesionError;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

// El rol de un usuario no se guarda aparte: se deduce de en cuál de las
// dos tablas de perfil tiene una fila.
export async function obtenerRolActual(): Promise<Rol | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: tecnico } = await supabase
    .from('paradaya_tecnicos')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (tecnico) return 'tecnico';

  const { data: empresa } = await supabase
    .from('paradaya_empresas')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (empresa) return 'empresa';

  return null;
}

function extraerParametrosDeHash(url: string): Record<string, string> {
  const indice = url.indexOf('#');
  if (indice === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(indice + 1)));
}
