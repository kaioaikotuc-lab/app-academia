-- Perfil do usuário (1 linha por usuário: id = user_id) e histórico de peso corporal
create table if not exists academia.perfis (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nome text,
  idade int,                 -- idade informada
  idade_em date,             -- data em que a idade foi informada (app calcula a idade atual)
  altura_cm numeric(5,1),
  sexo text,                 -- opcional: 'M' | 'F'
  meta_peso_kg numeric(5,1),
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint perfis_id_user check (id = user_id)
);
create table if not exists academia.pesagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  data date not null default current_date,
  peso_kg numeric(5,1) not null,
  notas text,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pesagens_user_idx on academia.pesagens(user_id, data);
create index if not exists perfis_user_idx on academia.perfis(user_id);

do $$ declare t text; begin
  foreach t in array array['perfis','pesagens'] loop
    execute format('drop trigger if exists tg_atualizado on academia.%I', t);
    execute format('create trigger tg_atualizado before insert or update on academia.%I for each row execute function academia.tocar_atualizado()', t);
    execute format('alter table academia.%I enable row level security', t);
    execute format('drop policy if exists dono on academia.%I', t);
    execute format('create policy dono on academia.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on academia.%I to authenticated, service_role', t);
    execute format('revoke all on academia.%I from anon', t);
  end loop;
end $$;

-- Helper do chat: grava/atualiza perfil e (opcionalmente) uma pesagem
-- {"nome":"Kaio","idade":28,"altura_cm":186,"peso_kg":70,"data":"2026-11-10"}
create or replace function academia_chat.salvar_perfil(p_email text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := academia_chat.uid(p_email); v_data date;
begin
  if v_user is null then raise exception 'Usuário % não encontrado', p_email; end if;
  v_data := coalesce((p_dados->>'data')::date, (now() at time zone 'America/Cuiaba')::date);
  insert into academia.perfis(id, user_id, nome, idade, idade_em, altura_cm, sexo, meta_peso_kg)
  values (v_user, v_user, p_dados->>'nome', (p_dados->>'idade')::int,
          case when p_dados ? 'idade' then v_data end, (p_dados->>'altura_cm')::numeric,
          p_dados->>'sexo', (p_dados->>'meta_peso_kg')::numeric)
  on conflict (id) do update set
    nome = coalesce(excluded.nome, academia.perfis.nome),
    idade = coalesce(excluded.idade, academia.perfis.idade),
    idade_em = coalesce(excluded.idade_em, academia.perfis.idade_em),
    altura_cm = coalesce(excluded.altura_cm, academia.perfis.altura_cm),
    sexo = coalesce(excluded.sexo, academia.perfis.sexo),
    meta_peso_kg = coalesce(excluded.meta_peso_kg, academia.perfis.meta_peso_kg),
    excluido = false;
  if p_dados ? 'peso_kg' then
    perform academia_chat.registrar_peso(p_email, (p_dados->>'peso_kg')::numeric, v_data);
  end if;
  return v_user;
end $$;

-- Registra peso corporal (uma pesagem por dia: substitui a do mesmo dia)
create or replace function academia_chat.registrar_peso(p_email text, p_peso numeric, p_data date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := academia_chat.uid(p_email); v_id uuid;
  v_data date := coalesce(p_data, (now() at time zone 'America/Cuiaba')::date);
begin
  if v_user is null then raise exception 'Usuário % não encontrado', p_email; end if;
  update academia.pesagens set peso_kg = p_peso where user_id = v_user and data = v_data and not excluido returning id into v_id;
  if v_id is null then
    insert into academia.pesagens(user_id, data, peso_kg) values (v_user, v_data, p_peso) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace view academia_chat.perfil as
select u.email, p.nome, p.idade, p.idade_em,
       p.idade + extract(year from age(current_date, p.idade_em))::int as idade_atual,
       p.altura_cm, pe.peso_kg as peso_atual_kg, pe.data as peso_em,
       round(pe.peso_kg / ((p.altura_cm / 100.0) ^ 2), 1) as imc
from academia.perfis p join auth.users u on u.id = p.user_id
left join lateral (select peso_kg, data from academia.pesagens x
                   where x.user_id = p.user_id and not x.excluido order by data desc limit 1) pe on true;

revoke all on all tables in schema academia_chat from public, anon, authenticated;
revoke execute on all functions in schema academia_chat from public, anon, authenticated;
