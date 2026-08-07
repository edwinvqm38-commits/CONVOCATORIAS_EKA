import React, { createContext, useContext, useMemo, useState } from 'react';

import {
  EMPRESA_DEMO,
  PARADAS_DEMO,
  POSTULACIONES_DEMO,
  POSTULANTES_DEMO,
  TECNICO_DEMO,
} from '@/data/mock';
import type { Empresa, EstadoPostulacion, Parada, Postulacion, Postulante, Rol } from '@/types';

interface AppStateValue {
  rol: Rol | null;
  setRol: (rol: Rol | null) => void;
  paradas: Parada[];
  postulantes: Postulante[];
  postulaciones: Postulacion[];
  empresa: Empresa;
  tecnico: Postulante;
  postular: (paradaId: string) => void;
  actualizarEstadoPostulacion: (postulacionId: string, estado: EstadoPostulacion) => void;
  postulacionDe: (paradaId: string, postulanteId: string) => Postulacion | undefined;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [rol, setRol] = useState<Rol | null>(null);
  const [paradas] = useState<Parada[]>(PARADAS_DEMO);
  const [postulantes] = useState<Postulante[]>(POSTULANTES_DEMO);
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>(POSTULACIONES_DEMO);

  const value = useMemo<AppStateValue>(
    () => ({
      rol,
      setRol,
      paradas,
      postulantes,
      postulaciones,
      empresa: EMPRESA_DEMO,
      tecnico: TECNICO_DEMO,
      postular: (paradaId) => {
        setPostulaciones((prev) => {
          const yaExiste = prev.some((p) => p.paradaId === paradaId && p.postulanteId === 'yo');
          if (yaExiste) return prev;
          return [
            ...prev,
            { id: `po-${paradaId}-${Date.now()}`, paradaId, postulanteId: 'yo', estado: 'enviada' },
          ];
        });
      },
      actualizarEstadoPostulacion: (postulacionId, estado) => {
        setPostulaciones((prev) =>
          prev.map((p) => (p.id === postulacionId ? { ...p, estado } : p))
        );
      },
      postulacionDe: (paradaId, postulanteId) =>
        postulaciones.find((p) => p.paradaId === paradaId && p.postulanteId === postulanteId),
    }),
    [rol, paradas, postulantes, postulaciones]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}
