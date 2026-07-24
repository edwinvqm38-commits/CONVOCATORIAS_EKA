-- Estado del flujo conversacional /convocar (un admin arma una convocatoria
-- paso a paso hablando con el bot). Una fila por chat_id: se borra cuando la
-- convocatoria se envia, se guarda como borrador, o se cancela.
create table if not exists convocatoria_sesiones (
    telegram_chat_id text primary key,
    paso text not null,
    datos jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
