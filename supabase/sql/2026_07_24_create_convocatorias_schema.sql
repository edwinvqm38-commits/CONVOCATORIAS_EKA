-- Esquema base del sistema de convocatorias por Telegram (paradas de planta).

create table if not exists convocatoria_usuarios (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id text not null unique,
    telegram_user_id text,
    nombre text,
    username text,
    empresa text,
    area text,
    estado text not null default 'activo', -- activo | bloqueado
    created_at timestamptz not null default now(),
    last_seen_at timestamptz
);

create table if not exists convocatorias (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    descripcion text,
    planta text,
    fecha_servicio date not null,
    hora_servicio text,
    fecha_limite_respuesta timestamptz,
    estado text not null default 'borrador', -- borrador | enviada | cerrada | cancelada
    creado_por text,
    created_at timestamptz not null default now(),
    enviada_at timestamptz
);

-- Un registro por cada mensaje individual enviado a un usuario para una
-- convocatoria: guarda el message_id de Telegram para poder editarlo cuando
-- llegue la respuesta (callback_query solo trae chat_id + message_id).
create table if not exists convocatoria_envios (
    id uuid primary key default gen_random_uuid(),
    convocatoria_id uuid not null references convocatorias(id) on delete cascade,
    telegram_chat_id text not null,
    telegram_message_id bigint,
    enviado_at timestamptz not null default now(),
    estado_envio text not null default 'enviado', -- enviado | fallido
    unique (convocatoria_id, telegram_chat_id)
);

create table if not exists convocatoria_respuestas (
    id uuid primary key default gen_random_uuid(),
    convocatoria_id uuid not null references convocatorias(id) on delete cascade,
    telegram_chat_id text not null,
    respuesta text not null, -- disponible | no_disponible | tal_vez
    comentario text,
    respondido_at timestamptz not null default now(),
    unique (convocatoria_id, telegram_chat_id)
);

create index if not exists idx_convocatoria_envios_convocatoria on convocatoria_envios(convocatoria_id);
create index if not exists idx_convocatoria_respuestas_convocatoria on convocatoria_respuestas(convocatoria_id);

-- Vista de resumen: cruza destinatarios contra respuestas para saber quien
-- confirmo, quien declino y quien aun no responde.
create or replace view convocatoria_resumen_v as
select
    e.convocatoria_id,
    e.telegram_chat_id,
    u.nombre,
    u.empresa,
    u.area,
    r.respuesta,
    r.comentario,
    r.respondido_at,
    e.enviado_at
from convocatoria_envios e
left join convocatoria_respuestas r
    on r.convocatoria_id = e.convocatoria_id
    and r.telegram_chat_id = e.telegram_chat_id
left join convocatoria_usuarios u
    on u.telegram_chat_id = e.telegram_chat_id;
