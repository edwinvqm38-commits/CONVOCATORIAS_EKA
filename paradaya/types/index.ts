import type { Especialidad } from '@/constants/especialidades';
import type { Cargo } from '@/constants/cargos';

export type Rol = 'tecnico' | 'empresa';

export type EstadoParada = 'vigente' | 'cerrada';

export interface Parada {
  id: string;
  titulo: string;
  unidadMinera: string;
  ubicacion: string;
  fechaInicio: string; // dd/mm/aaaa
  fechaFin: string; // dd/mm/aaaa
  especialidad: Especialidad;
  cargo: Cargo;
  vacantes: number;
  requisitosMinimos: string;
  descripcion: string;
  estado: EstadoParada;
  empresaId: string;
}

export interface ExperienciaLaboral {
  cargo: string;
  lugar: string;
  fechas: string;
}

export interface Postulante {
  id: string;
  nombre: string;
  especialidad: Especialidad;
  aniosExperiencia: number;
  ubicacion: string;
  cvNombre: string;
  experiencia: ExperienciaLaboral[];
  certificaciones: string[];
}

export type EstadoPostulacion = 'enviada' | 'vista' | 'aceptada' | 'rechazada';

export interface Postulacion {
  id: string;
  paradaId: string;
  postulanteId: string;
  estado: EstadoPostulacion;
}

export interface Empresa {
  id: string;
  nombre: string;
  ruc: string;
  sector: string;
  descripcion: string;
}
