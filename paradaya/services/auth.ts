import { supabase } from '@/lib/supabase';
import type { Rol } from '@/types';

// MVP solo-Perú (ver README, sección 8): si el número no trae código de
// país, se asume Perú. Mismo criterio que ya usa el bot de Telegram de
// este repo para los teléfonos.
export function normalizarTelefono(telefono: string): string {
  const limpio = telefono.replace(/[\s-]/g, '');
  if (limpio.startsWith('+')) return limpio;
  if (limpio.startsWith('51')) return `+${limpio}`;
  return `+51${limpio}`;
}

export async function enviarCodigoTelefono(telefono: string): Promise<string> {
  const telefonoNormalizado = normalizarTelefono(telefono);
  const { error } = await supabase.auth.signInWithOtp({ phone: telefonoNormalizado });
  if (error) throw error;
  return telefonoNormalizado;
}

// Confirma el código SMS. Si es la primera vez que este teléfono entra a
// ParadaYa, Supabase crea la cuenta ahí mismo — por eso devolvemos
// "esNuevo" para que la pantalla le pida nombre (y rol) antes de dejarlo
// pasar al feed.
export async function verificarCodigoTelefono(
  telefono: string,
  codigo: string
): Promise<{ esNuevo: boolean }> {
  const { error } = await supabase.auth.verifyOtp({
    phone: normalizarTelefono(telefono),
    token: codigo,
    type: 'sms',
  });
  if (error) throw error;

  const rolActual = await obtenerRolActual();
  return { esNuevo: rolActual === null };
}

export async function completarRegistroTecnico(nombresCompletos: string, correoContacto?: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No hay una sesión activa.');

  const { error } = await supabase.from('paradaya_tecnicos').insert({
    user_id: data.user.id,
    nombres_completos: nombresCompletos,
    correo_contacto: correoContacto || null,
    telefono: data.user.phone ?? null,
  });
  if (error) throw error;
}

export async function completarRegistroEmpresa(nombre: string, ruc: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('No hay una sesión activa.');

  const { error } = await supabase
    .from('paradaya_empresas')
    .insert({ user_id: data.user.id, nombre, ruc });
  if (error) throw error;
}

export async function registrarTecnico(correo: string, clave: string, nombresCompletos: string) {
  const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
  if (error) throw error;
  if (!data.user) throw new Error('No se pudo crear la cuenta.');
  await completarRegistroTecnico(nombresCompletos);
}

export async function registrarEmpresa(correo: string, clave: string, nombre: string, ruc: string) {
  const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
  if (error) throw error;
  if (!data.user) throw new Error('No se pudo crear la cuenta.');
  await completarRegistroEmpresa(nombre, ruc);
}

export async function iniciarSesionConCorreo(correo: string, clave: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw error;
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
