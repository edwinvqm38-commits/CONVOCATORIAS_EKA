// Catálogo predefinido + opción "otra" (ver README.md, sección 8).
// Lista de partida a confirmar con el cliente (sección 9, pregunta 3).
export const CERTIFICACIONES = [
  'IPERC vigente',
  'Trabajos en altura',
  'Espacios confinados',
  'Manejo defensivo',
  'Primeros auxilios',
  'Izaje y aparejo',
  'Otra',
] as const;

export type CertificacionCatalogo = (typeof CERTIFICACIONES)[number];
