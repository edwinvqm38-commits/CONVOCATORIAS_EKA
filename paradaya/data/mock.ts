import type { Empresa, EstadoPostulacion, Parada, Postulacion, Postulante } from '@/types';

// Datos de ejemplo para poder navegar y probar la app sin backend todavía
// (Supabase se conecta en la Fase 2). Nombres de empresas, unidades mineras
// y personas son ficticios.

export const EMPRESA_DEMO: Empresa = {
  id: 'e1',
  nombre: 'Servicios Industriales del Sur SAC',
  ruc: '20601234567',
  sector: 'Minería — Mantenimiento',
  descripcion:
    'Empresa contratista especializada en mantenimiento mecánico y eléctrico para paradas de planta.',
};

// El técnico que tiene la sesión iniciada en esta demo.
export const TECNICO_DEMO: Postulante = {
  id: 'yo',
  nombre: 'Jorge Condori Mamani',
  especialidad: 'Mecánico',
  aniosExperiencia: 6,
  ubicacion: 'Arequipa',
  cvNombre: 'CV_Jorge_Condori.pdf',
  experiencia: [
    { cargo: 'Técnico Mecánico', lugar: 'Unidad Minera Toromina', fechas: '2022–2024' },
    { cargo: 'Ayudante Mecánico', lugar: 'Planta Cementos del Centro', fechas: '2019–2022' },
  ],
  certificaciones: ['IPERC vigente'],
};

export const PARADAS_DEMO: Parada[] = [
  {
    id: 'p1',
    titulo: 'Parada General — Planta Concentradora',
    unidadMinera: 'Unidad Minera Los Andes',
    ubicacion: 'Arequipa',
    fechaInicio: '12/08/2026',
    fechaFin: '26/08/2026',
    especialidad: 'Mecánico',
    cargo: 'Técnico',
    vacantes: 15,
    requisitosMinimos:
      '3 años de experiencia en mantenimiento mecánico industrial. Certificación IPERC vigente. Licencia de conducir A-I.',
    descripcion:
      'Overhaul de chancadora primaria y fajas transportadoras. Alojamiento y alimentación incluidos.',
    estado: 'vigente',
    empresaId: 'e1',
  },
  {
    id: 'p2',
    titulo: 'Mantenimiento Programado Cuatrienal',
    unidadMinera: 'Unidad Minera Alto Chicama',
    ubicacion: 'La Libertad',
    fechaInicio: '20/08/2026',
    fechaFin: '10/09/2026',
    especialidad: 'Instrumentación',
    cargo: 'Supervisor',
    vacantes: 6,
    requisitosMinimos: '5 años de experiencia en instrumentación industrial. Certificación vigente.',
    descripcion: 'Calibración y overhaul de instrumentación de planta concentradora.',
    estado: 'vigente',
    empresaId: 'e1',
  },
  {
    id: 'p3',
    titulo: 'Parada de Chancado Primario',
    unidadMinera: 'Planta Ilo Sur',
    ubicacion: 'Moquegua',
    fechaInicio: '01/09/2026',
    fechaFin: '15/09/2026',
    especialidad: 'Soldadura',
    cargo: 'Técnico',
    vacantes: 8,
    requisitosMinimos: '2 años de experiencia en soldadura estructural. Certificación de soldador vigente.',
    descripcion: 'Reparación estructural de chancadora primaria.',
    estado: 'vigente',
    empresaId: 'e1',
  },
  {
    id: 'p4',
    titulo: 'Parada Eléctrica — Refinería Norte',
    unidadMinera: 'Refinería Norte',
    ubicacion: 'Piura',
    fechaInicio: '02/07/2026',
    fechaFin: '18/07/2026',
    especialidad: 'Eléctrico',
    cargo: 'Técnico',
    vacantes: 5,
    requisitosMinimos: '3 años de experiencia en mantenimiento eléctrico industrial.',
    descripcion: 'Mantenimiento de subestación eléctrica y tableros de control.',
    estado: 'cerrada',
    empresaId: 'e1',
  },
  {
    id: 'p5',
    titulo: 'Parada de Instrumentación y Control',
    unidadMinera: 'Unidad Minera San Rafael',
    ubicacion: 'Puno',
    fechaInicio: '05/10/2026',
    fechaFin: '20/10/2026',
    especialidad: 'Instrumentación',
    cargo: 'Técnico',
    vacantes: 10,
    requisitosMinimos: '2 años de experiencia en instrumentación. Certificación IPERC vigente.',
    descripcion: 'Calibración de instrumentos de campo y lazos de control.',
    estado: 'vigente',
    empresaId: 'e1',
  },
];

export const POSTULANTES_DEMO: Postulante[] = [
  {
    id: 'renzo',
    nombre: 'Renzo Cárdenas Salas',
    especialidad: 'Mecánico',
    aniosExperiencia: 6,
    ubicacion: 'Arequipa',
    cvNombre: 'CV_Renzo_Cardenas.pdf',
    experiencia: [
      { cargo: 'Técnico Mecánico', lugar: 'Unidad Minera Toromina', fechas: '2022–2024' },
      { cargo: 'Ayudante Mecánico', lugar: 'Planta Cementos del Centro', fechas: '2019–2022' },
    ],
    certificaciones: ['IPERC vigente', 'Trabajos en altura · vence dic 2026'],
  },
  {
    id: 'milagros',
    nombre: 'Milagros Huamán Ríos',
    especialidad: 'Mecánico',
    aniosExperiencia: 9,
    ubicacion: 'Arequipa',
    cvNombre: 'CV_Milagros_Huaman.pdf',
    experiencia: [{ cargo: 'Técnico Mecánico Senior', lugar: 'Unidad Minera Los Andes', fechas: '2017–2025' }],
    certificaciones: ['IPERC vigente'],
  },
  {
    id: 'diego',
    nombre: 'Diego Farfán Ortiz',
    especialidad: 'Mecánico',
    aniosExperiencia: 4,
    ubicacion: 'Moquegua',
    cvNombre: 'CV_Diego_Farfan.pdf',
    experiencia: [{ cargo: 'Técnico Mecánico', lugar: 'Planta Ilo Sur', fechas: '2021–2025' }],
    certificaciones: ['IPERC vigente', 'Espacios confinados'],
  },
  TECNICO_DEMO,
];

export const POSTULACIONES_DEMO: Postulacion[] = [
  { id: 'po1', paradaId: 'p1', postulanteId: 'renzo', estado: 'enviada' },
  { id: 'po2', paradaId: 'p1', postulanteId: 'milagros', estado: 'vista' },
  { id: 'po3', paradaId: 'p1', postulanteId: 'diego', estado: 'aceptada' },
  { id: 'po4', paradaId: 'p1', postulanteId: 'yo', estado: 'vista' },
  { id: 'po5', paradaId: 'p2', postulanteId: 'yo', estado: 'aceptada' },
  { id: 'po6', paradaId: 'p3', postulanteId: 'yo', estado: 'enviada' },
  { id: 'po7', paradaId: 'p4', postulanteId: 'yo', estado: 'rechazada' },
];

export const ESTADO_LABEL: Record<EstadoPostulacion, string> = {
  enviada: 'Enviada',
  vista: 'Vista',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};
