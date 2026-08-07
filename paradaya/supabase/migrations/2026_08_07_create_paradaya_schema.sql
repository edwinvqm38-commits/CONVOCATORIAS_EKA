-- Esquema de ParadaYa. Todas las tablas llevan el prefijo "paradaya_" para
-- poder vivir en el MISMO proyecto de Supabase que ya usa EKA Convocatorias
-- (tablas "convocatoria_*") sin chocar con ellas. Si en algún momento
-- ParadaYa se muda a su propio proyecto de Supabase, este archivo se puede
-- correr tal cual ahí también.
--
-- A diferencia de "convocatoria_*" (que solo usa el bot con la service_role
-- key, sin RLS), estas tablas las llama la propia app desde el celular de
-- cada usuario con la anon key — por eso TODAS llevan Row Level Security
-- activado con políticas explícitas.

-- ============================================================
-- 1. Catálogo de especialidades (extensible: ver política de insert abajo)
-- ============================================================
create table if not exists paradaya_especialidades (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    created_at timestamptz not null default now()
);

insert into paradaya_especialidades (nombre) values
    ('Mecánico'), ('Eléctrico'), ('Instrumentación'), ('Soldadura'),
    ('Andamiaje'), ('Aislamiento térmico'), ('Calderería'),
    ('Izaje y aparejo'), ('Civil/Construcción'),
    ('Prevención de riesgos (SSOMA)'), ('Almacén/Logística'),
    ('Chofer/Operador de equipo pesado')
on conflict (nombre) do nothing;

-- ============================================================
-- 2. Perfiles: empresa y técnico, uno por usuario de auth.users
-- ============================================================
create table if not exists paradaya_empresas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    nombre text not null,
    ruc text not null,
    sector text,
    logo_path text, -- ruta dentro del bucket paradaya-logos
    descripcion text,
    created_at timestamptz not null default now()
);

create table if not exists paradaya_tecnicos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    nombres_completos text not null,
    dni text,
    telefono text,
    ubicacion text, -- región (ver constants/regiones.ts)
    anios_experiencia_total int,
    created_at timestamptz not null default now()
);

create table if not exists paradaya_tecnico_especialidades (
    id uuid primary key default gen_random_uuid(),
    tecnico_id uuid not null references paradaya_tecnicos(id) on delete cascade,
    especialidad_id uuid not null references paradaya_especialidades(id),
    anios_experiencia int,
    unique (tecnico_id, especialidad_id)
);

create table if not exists paradaya_experiencia_laboral (
    id uuid primary key default gen_random_uuid(),
    tecnico_id uuid not null references paradaya_tecnicos(id) on delete cascade,
    empresa_nombre text not null,
    tipo_planta text,
    cargo text,
    especialidad_id uuid references paradaya_especialidades(id),
    fecha_inicio date,
    fecha_fin date,
    created_at timestamptz not null default now()
);

create table if not exists paradaya_certificaciones (
    id uuid primary key default gen_random_uuid(),
    tecnico_id uuid not null references paradaya_tecnicos(id) on delete cascade,
    nombre text not null,
    entidad text,
    fecha_vencimiento date,
    created_at timestamptz not null default now()
);

-- CVs, DNI, licencias, etc. — el archivo en sí vive en el bucket de Storage
-- "paradaya-documentos"; esta tabla es el índice con metadata.
create table if not exists paradaya_documentos (
    id uuid primary key default gen_random_uuid(),
    tecnico_id uuid not null references paradaya_tecnicos(id) on delete cascade,
    tipo text not null check (tipo in ('cv', 'dni', 'licencia', 'certificado', 'otro')),
    storage_path text not null,
    nombre_archivo text,
    created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Paradas de planta y postulaciones
-- ============================================================
create table if not exists paradaya_paradas_planta (
    id uuid primary key default gen_random_uuid(),
    empresa_id uuid not null references paradaya_empresas(id) on delete cascade,
    titulo text not null,
    unidad_minera text not null,
    ubicacion text not null,
    fecha_inicio date not null,
    fecha_fin date not null,
    especialidad_id uuid not null references paradaya_especialidades(id),
    cargo text not null,
    vacantes int not null default 1,
    requisitos_minimos text,
    descripcion text,
    estado text not null default 'vigente' check (estado in ('vigente', 'cerrada')),
    created_at timestamptz not null default now()
);

create table if not exists paradaya_postulaciones (
    id uuid primary key default gen_random_uuid(),
    parada_id uuid not null references paradaya_paradas_planta(id) on delete cascade,
    tecnico_id uuid not null references paradaya_tecnicos(id) on delete cascade,
    estado text not null default 'enviada' check (estado in ('enviada', 'vista', 'aceptada', 'rechazada')),
    created_at timestamptz not null default now(),
    unique (parada_id, tecnico_id)
);

create index if not exists idx_paradaya_paradas_empresa on paradaya_paradas_planta(empresa_id);
create index if not exists idx_paradaya_postulaciones_parada on paradaya_postulaciones(parada_id);
create index if not exists idx_paradaya_postulaciones_tecnico on paradaya_postulaciones(tecnico_id);

-- ============================================================
-- 4. Row Level Security — la app llama a Supabase con la anon key desde
--    el celular de cada usuario, así que cada tabla necesita sus propias
--    reglas (a diferencia de convocatoria_*, que solo usa el bot).
-- ============================================================
alter table paradaya_especialidades enable row level security;
alter table paradaya_empresas enable row level security;
alter table paradaya_tecnicos enable row level security;
alter table paradaya_tecnico_especialidades enable row level security;
alter table paradaya_experiencia_laboral enable row level security;
alter table paradaya_certificaciones enable row level security;
alter table paradaya_documentos enable row level security;
alter table paradaya_paradas_planta enable row level security;
alter table paradaya_postulaciones enable row level security;

-- Especialidades: cualquier usuario logueado las puede ver y agregar
-- nuevas (catálogo extensible), nadie las borra desde la app.
create policy "especialidades: lectura para todos los logueados"
    on paradaya_especialidades for select to authenticated using (true);
create policy "especialidades: cualquier logueado puede agregar una nueva"
    on paradaya_especialidades for insert to authenticated with check (true);

-- Empresas: cualquier logueado puede ver el perfil (nombre/sector de una
-- parada publicada es información pública dentro de la app); solo la
-- propia empresa crea/edita su fila.
create policy "empresas: lectura para todos los logueados"
    on paradaya_empresas for select to authenticated using (true);
create policy "empresas: solo la propia empresa crea su perfil"
    on paradaya_empresas for insert to authenticated with check (auth.uid() = user_id);
create policy "empresas: solo la propia empresa edita su perfil"
    on paradaya_empresas for update to authenticated using (auth.uid() = user_id);

-- Técnicos: el propio técnico gestiona su perfil completo; una empresa
-- puede ver el perfil de un técnico solo si ese técnico le postuló a
-- alguna de sus paradas.
create policy "tecnicos: el propio tecnico ve y edita su perfil"
    on paradaya_tecnicos for select to authenticated using (auth.uid() = user_id);
create policy "tecnicos: el propio tecnico crea su perfil"
    on paradaya_tecnicos for insert to authenticated with check (auth.uid() = user_id);
create policy "tecnicos: el propio tecnico edita su perfil"
    on paradaya_tecnicos for update to authenticated using (auth.uid() = user_id);
create policy "tecnicos: empresas ven perfil de sus postulantes"
    on paradaya_tecnicos for select to authenticated using (
        exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            where po.tecnico_id = paradaya_tecnicos.id and e.user_id = auth.uid()
        )
    );

-- Las tablas "hijas" del perfil técnico (especialidades, experiencia,
-- certificaciones, documentos) siguen la misma regla: dueño siempre, más
-- la empresa cuando ese técnico le postuló.
create policy "tecnico_especialidades: dueño"
    on paradaya_tecnico_especialidades for all to authenticated
    using (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()))
    with check (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()));
create policy "tecnico_especialidades: empresas de sus postulantes"
    on paradaya_tecnico_especialidades for select to authenticated using (
        exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            where po.tecnico_id = paradaya_tecnico_especialidades.tecnico_id and e.user_id = auth.uid()
        )
    );

create policy "experiencia_laboral: dueño"
    on paradaya_experiencia_laboral for all to authenticated
    using (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()))
    with check (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()));
create policy "experiencia_laboral: empresas de sus postulantes"
    on paradaya_experiencia_laboral for select to authenticated using (
        exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            where po.tecnico_id = paradaya_experiencia_laboral.tecnico_id and e.user_id = auth.uid()
        )
    );

create policy "certificaciones: dueño"
    on paradaya_certificaciones for all to authenticated
    using (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()))
    with check (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()));
create policy "certificaciones: empresas de sus postulantes"
    on paradaya_certificaciones for select to authenticated using (
        exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            where po.tecnico_id = paradaya_certificaciones.tecnico_id and e.user_id = auth.uid()
        )
    );

create policy "documentos: dueño"
    on paradaya_documentos for all to authenticated
    using (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()))
    with check (exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid()));
create policy "documentos: empresas de sus postulantes"
    on paradaya_documentos for select to authenticated using (
        exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            where po.tecnico_id = paradaya_documentos.tecnico_id and e.user_id = auth.uid()
        )
    );

-- Paradas de planta: vigentes visibles para cualquier logueado (el feed
-- del técnico); la empresa dueña ve/edita también las cerradas.
create policy "paradas: lectura de vigentes para todos los logueados"
    on paradaya_paradas_planta for select to authenticated using (
        estado = 'vigente'
        or exists (select 1 from paradaya_empresas e where e.id = empresa_id and e.user_id = auth.uid())
    );
create policy "paradas: solo la empresa dueña publica"
    on paradaya_paradas_planta for insert to authenticated with check (
        exists (select 1 from paradaya_empresas e where e.id = empresa_id and e.user_id = auth.uid())
    );
create policy "paradas: solo la empresa dueña edita/cierra"
    on paradaya_paradas_planta for update to authenticated using (
        exists (select 1 from paradaya_empresas e where e.id = empresa_id and e.user_id = auth.uid())
    );

-- Postulaciones: el técnico ve y crea las suyas; la empresa dueña de la
-- parada ve todas las que le llegaron y puede cambiarles el estado.
create policy "postulaciones: el tecnico ve las suyas"
    on paradaya_postulaciones for select to authenticated using (
        exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid())
    );
create policy "postulaciones: el tecnico postula"
    on paradaya_postulaciones for insert to authenticated with check (
        exists (select 1 from paradaya_tecnicos t where t.id = tecnico_id and t.user_id = auth.uid())
    );
create policy "postulaciones: la empresa ve las de sus paradas"
    on paradaya_postulaciones for select to authenticated using (
        exists (
            select 1 from paradaya_paradas_planta pp
            join paradaya_empresas e on e.id = pp.empresa_id
            where pp.id = parada_id and e.user_id = auth.uid()
        )
    );
create policy "postulaciones: la empresa acepta o rechaza"
    on paradaya_postulaciones for update to authenticated using (
        exists (
            select 1 from paradaya_paradas_planta pp
            join paradaya_empresas e on e.id = pp.empresa_id
            where pp.id = parada_id and e.user_id = auth.uid()
        )
    );

-- ============================================================
-- 5. Storage: buckets para CVs/documentos (privado) y logos (público)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('paradaya-documentos', 'paradaya-documentos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('paradaya-logos', 'paradaya-logos', true)
on conflict (id) do nothing;

-- Convención de ruta: siempre "{auth.uid()}/archivo.ext" — así la política
-- solo tiene que comparar el primer segmento de la ruta con el usuario.
create policy "documentos: el dueño sube/lee/borra su carpeta"
    on storage.objects for all to authenticated
    using (bucket_id = 'paradaya-documentos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'paradaya-documentos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documentos: empresas leen los de sus postulantes"
    on storage.objects for select to authenticated using (
        bucket_id = 'paradaya-documentos'
        and exists (
            select 1 from paradaya_postulaciones po
            join paradaya_paradas_planta pp on pp.id = po.parada_id
            join paradaya_empresas e on e.id = pp.empresa_id
            join paradaya_tecnicos t on t.id = po.tecnico_id
            where e.user_id = auth.uid()
              and t.user_id::text = (storage.foldername(name))[1]
        )
    );

create policy "logos: el dueño sube/edita/borra su carpeta"
    on storage.objects for all to authenticated
    using (bucket_id = 'paradaya-logos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'paradaya-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: lectura pública"
    on storage.objects for select to anon, authenticated using (bucket_id = 'paradaya-logos');
