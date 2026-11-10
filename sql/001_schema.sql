-- App Academia — schema "academia" (isolado do resto do projeto Supabase)
create schema if not exists academia;

create or replace function academia.tocar_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end $$;

-- Exercícios: user_id NULL = biblioteca padrão (somente leitura para todos)
create table if not exists academia.exercicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  nome text not null,
  grupo text not null default 'Outros',
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Fichas / rotinas (Treino A, B, C...)
create table if not exists academia.fichas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nome text not null,
  descricao text,
  ordem int not null default 0,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists academia.ficha_exercicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ficha_id uuid not null references academia.fichas(id) on delete cascade,
  exercicio_id uuid not null references academia.exercicios(id) on delete cascade,
  ordem int not null default 0,
  series int not null default 3,
  reps_alvo text not null default '10',
  descanso_seg int not null default 90,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Sessões de treino realizadas
create table if not exists academia.sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ficha_id uuid references academia.fichas(id) on delete set null,
  nome text not null default 'Treino',
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  notas text,
  origem text not null default 'app',  -- 'app' | 'chat'
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Séries de cada sessão
create table if not exists academia.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sessao_id uuid not null references academia.sessoes(id) on delete cascade,
  exercicio_id uuid not null references academia.exercicios(id) on delete cascade,
  ordem_exercicio int not null default 0,
  numero int not null default 1,
  carga_kg numeric(6,2) not null default 0,
  reps int not null default 0,
  feita boolean not null default false,
  feita_em timestamptz,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists series_user_exerc_idx on academia.series(user_id, exercicio_id);
create index if not exists series_sessao_idx on academia.series(sessao_id);
create index if not exists sessoes_user_idx on academia.sessoes(user_id, iniciada_em desc);
create index if not exists fe_ficha_idx on academia.ficha_exercicios(ficha_id);
create index if not exists exerc_user_idx on academia.exercicios(user_id);
create index if not exists fichas_user_idx on academia.fichas(user_id);
create index if not exists fe_user_idx on academia.ficha_exercicios(user_id);
create index if not exists fe_exerc_idx on academia.ficha_exercicios(exercicio_id);
create index if not exists series_exerc_idx on academia.series(exercicio_id);
create index if not exists sessoes_ficha_idx on academia.sessoes(ficha_id);

do $$ declare t text; begin
  foreach t in array array['exercicios','fichas','ficha_exercicios','sessoes','series'] loop
    execute format('drop trigger if exists tg_atualizado on academia.%I', t);
    execute format('create trigger tg_atualizado before insert or update on academia.%I for each row execute function academia.tocar_atualizado()', t);
    execute format('alter table academia.%I enable row level security', t);
  end loop;
end $$;

-- RLS: cada usuário só vê/edita o que é dele
drop policy if exists exerc_sel on academia.exercicios;
create policy exerc_sel on academia.exercicios for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
drop policy if exists exerc_ins on academia.exercicios;
create policy exerc_ins on academia.exercicios for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists exerc_upd on academia.exercicios;
create policy exerc_upd on academia.exercicios for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists exerc_del on academia.exercicios;
create policy exerc_del on academia.exercicios for delete to authenticated
  using (user_id = (select auth.uid()));

do $$ declare t text; begin
  foreach t in array array['fichas','ficha_exercicios','sessoes','series'] loop
    execute format('drop policy if exists dono on academia.%I', t);
    execute format('create policy dono on academia.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant usage on schema academia to authenticated, service_role;
grant select, insert, update, delete on all tables in schema academia to authenticated, service_role;
revoke all on all tables in schema academia from anon;
