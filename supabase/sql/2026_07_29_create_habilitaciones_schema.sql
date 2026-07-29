-- Esquema de habilitaciones de personal tecnico (EMO, inducciones, cursos,
-- SCTR) para paradas de planta en mina. Prefijo "convocatoria_" para
-- mantener el mismo namespace que el resto del sistema de Convocatorias EKA
-- en este proyecto compartido (OFICINA_IA). Pensado para trabajarse desde
-- una herramienta tipo NocoDB (tabla/kanban/colores por select) conectada
-- directo a este Postgres, como panel aparte del Google Sheet de
-- reclutamiento.

-- Directorio de personas (una fila por DNI, sin duplicar por convocatoria).
-- Se alimenta solo del bot de Telegram via el trigger de mas abajo; los
-- datos de habilitacion se cargan aparte, a mano o por importacion.
create table if not exists convocatoria_personal (
    dni text primary key,
    nombres_completos text,
    telefono text,
    lugar_residencia text,
    especialidad text,
    creado_at timestamptz not null default now(),
    actualizado_at timestamptz not null default now()
);

do $$ begin
    create type convocatoria_categoria_habilitacion as enum (
        'examen_medico',
        'induccion_general',
        'induccion_especifica',
        'curso_trabajos_altura',
        'curso_espacios_confinados',
        'curso_izaje',
        'manejo_defensivo',
        'sctr',
        'otro'
    );
exception
    when duplicate_object then null;
end $$;

-- Una fila por cada habilitacion/curso/examen de una persona. Normalizado
-- (no una columna por tipo) porque la lista de cursos exigidos varia segun
-- el puesto/mina, y asi se puede agrupar/kanban por "categoria" en NocoDB.
create table if not exists convocatoria_habilitaciones (
    id uuid primary key default gen_random_uuid(),
    dni text not null references convocatoria_personal(dni) on delete cascade,
    categoria convocatoria_categoria_habilitacion not null,
    descripcion text, -- nombre exacto del curso/documento si categoria = 'otro'
    fecha_emision date,
    fecha_vencimiento date,
    resultado text, -- ej. apto / apto_con_restricciones / no_apto (aplica a examen_medico)
    archivo_url text, -- link al certificado/documento (Drive u otro)
    observaciones text,
    creado_at timestamptz not null default now(),
    actualizado_at timestamptz not null default now()
);

create index if not exists idx_convocatoria_habilitaciones_dni on convocatoria_habilitaciones(dni);

-- Estado de cada habilitacion individual: vigente / por vencer (<=30 dias) /
-- vencido / sin vencimiento registrado. Calculado, no se guarda a mano para
-- que nunca quede desactualizado.
create or replace view convocatoria_habilitaciones_estado_v as
select
    h.*,
    p.nombres_completos,
    case
        when h.fecha_vencimiento is null then 'sin_vencimiento'
        when h.fecha_vencimiento < current_date then 'vencido'
        when h.fecha_vencimiento <= current_date + interval '30 days' then 'por_vencer'
        else 'vigente'
    end as estado
from convocatoria_habilitaciones h
join convocatoria_personal p on p.dni = h.dni;

-- Estado general por persona: "habilitado" solo si ninguna de sus
-- habilitaciones registradas esta vencida. Es la vista pensada para el
-- kanban principal (agrupar por estado_general).
create or replace view convocatoria_personal_estado_v as
select
    p.dni,
    p.nombres_completos,
    p.telefono,
    p.lugar_residencia,
    p.especialidad,
    count(h.id) as total_habilitaciones,
    count(*) filter (where h.fecha_vencimiento < current_date) as vencidas,
    count(*) filter (
        where h.fecha_vencimiento >= current_date and h.fecha_vencimiento <= current_date + interval '30 days'
    ) as por_vencer,
    case
        when count(h.id) = 0 then 'sin_habilitaciones'
        when count(*) filter (where h.fecha_vencimiento < current_date) > 0 then 'no_habilitado'
        when count(*) filter (
            where h.fecha_vencimiento >= current_date and h.fecha_vencimiento <= current_date + interval '30 days'
        ) > 0 then 'por_vencer'
        else 'habilitado'
    end as estado_general
from convocatoria_personal p
left join convocatoria_habilitaciones h on h.dni = p.dni
group by p.dni, p.nombres_completos, p.telefono, p.lugar_residencia, p.especialidad;

-- Mantiene convocatoria_personal alimentado automaticamente con cada
-- respuesta del bot de Telegram (sin duplicar por convocatoria, ni pisar un
-- dato mas completo con uno vacio de una respuesta a medio llenar).
create or replace function convocatoria_sync_personal() returns trigger as $$
begin
    if new.dni is not null and new.dni <> '' then
        insert into convocatoria_personal (dni, nombres_completos, telefono, lugar_residencia, especialidad, actualizado_at)
        values (new.dni, new.nombres_completos, new.telefono, new.lugar_residencia, new.especialidad, now())
        on conflict (dni) do update set
            nombres_completos = coalesce(excluded.nombres_completos, convocatoria_personal.nombres_completos),
            telefono = coalesce(excluded.telefono, convocatoria_personal.telefono),
            lugar_residencia = coalesce(excluded.lugar_residencia, convocatoria_personal.lugar_residencia),
            especialidad = coalesce(excluded.especialidad, convocatoria_personal.especialidad),
            actualizado_at = now();
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists convocatoria_respuestas_sync_personal on convocatoria_respuestas;
create trigger convocatoria_respuestas_sync_personal
after insert or update of dni, nombres_completos, telefono, lugar_residencia, especialidad
on convocatoria_respuestas
for each row execute function convocatoria_sync_personal();

-- Carga inicial: dedupe de todo lo que ya respondio el bot hasta ahora.
insert into convocatoria_personal (dni, nombres_completos, telefono, lugar_residencia, especialidad)
select distinct on (dni) dni, nombres_completos, telefono, lugar_residencia, especialidad
from convocatoria_respuestas
where dni is not null and dni <> ''
order by dni, respondido_at desc nulls last
on conflict (dni) do nothing;
