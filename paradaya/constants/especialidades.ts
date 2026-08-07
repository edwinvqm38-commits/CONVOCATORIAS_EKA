// Catálogo de especialidades técnicas. Es el catálogo inicial acordado con
// el cliente (ver paradaya/README.md, sección 8) — pensado como extensible:
// más adelante una empresa podrá agregar una especialidad nueva al publicar
// una parada, igual que hace /especialidad_agregar en el bot de Telegram de
// este mismo repositorio.
export const ESPECIALIDADES = [
  'Mecánico',
  'Eléctrico',
  'Instrumentación',
  'Soldadura',
  'Andamiaje',
  'Aislamiento térmico',
  'Calderería',
  'Izaje y aparejo',
  'Civil/Construcción',
  'Prevención de riesgos (SSOMA)',
  'Almacén/Logística',
  'Chofer/Operador de equipo pesado',
] as const;

export type Especialidad = (typeof ESPECIALIDADES)[number];
