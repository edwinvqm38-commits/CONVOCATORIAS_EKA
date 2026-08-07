// Propuesta pendiente de confirmar (ver README.md, sección 9).
export const CARGOS = [
  'Técnico',
  'Oficial',
  'Supervisor',
  'Ingeniero',
  'Jefe de grupo/Capataz',
  'Prevencionista',
] as const;

export type Cargo = (typeof CARGOS)[number];
