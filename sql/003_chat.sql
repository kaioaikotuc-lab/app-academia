-- Funções/visões para o ASSISTENTE registrar e ler treinos pelo chat (via execute_sql do Supabase MCP).
-- Ficam no schema "academia_chat", que NÃO é exposto na API pública: só quem tem acesso
-- administrativo ao banco (MCP/painel) consegue usar.
create schema if not exists academia_chat;
revoke all on schema academia_chat from public, anon, authenticated;

create or replace function academia_chat.uid(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

-- Acha (ou cria) um exercício pelo nome para o usuário
create or replace function academia_chat.exercicio_id(p_user uuid, p_nome text, p_grupo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  select id into v from academia.exercicios
   where (user_id = p_user or user_id is null) and not excluido
     and lower(nome) = lower(trim(p_nome))
   order by (user_id is null) limit 1;
  if v is null then
    select id into v from academia.exercicios
     where (user_id = p_user or user_id is null) and not excluido
       and nome ilike '%' || trim(p_nome) || '%'
     order by (user_id is null), length(nome) limit 1;
  end if;
  if v is null then
    insert into academia.exercicios(user_id, nome, grupo)
    values (p_user, trim(p_nome), coalesce(p_grupo, 'Outros')) returning id into v;
  end if;
  return v;
end $$;

-- Registra uma sessão completa a partir de um JSON. Retorna o id da sessão.
-- Formato:
-- {"data":"2026-11-10T07:30:00-04:00","nome":"Treino A","ficha":"Treino A","notas":"...",
--  "exercicios":[{"nome":"Supino reto com barra","grupo":"Peito",
--                 "series":[{"carga":60,"reps":10},{"carga":60,"reps":8}]}]}
create or replace function academia_chat.registrar_sessao(p_email text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := academia_chat.uid(p_email);
  v_sessao uuid; v_ficha uuid; v_ex uuid; v_ini timestamptz;
  e jsonb; s jsonb; i int := 0; n int;
begin
  if v_user is null then raise exception 'Usuário % não encontrado', p_email; end if;
  v_ini := coalesce((p_dados->>'data')::timestamptz, now());
  if p_dados ? 'ficha' then
    select id into v_ficha from academia.fichas
     where user_id = v_user and not excluido and lower(nome) = lower(p_dados->>'ficha') limit 1;
  end if;
  insert into academia.sessoes(user_id, ficha_id, nome, iniciada_em, finalizada_em, notas, origem)
  values (v_user, v_ficha, coalesce(p_dados->>'nome', p_dados->>'ficha', 'Treino'), v_ini,
          coalesce((p_dados->>'fim')::timestamptz, v_ini + interval '1 hour'), p_dados->>'notas', 'chat')
  returning id into v_sessao;
  for e in select * from jsonb_array_elements(coalesce(p_dados->'exercicios','[]'::jsonb)) loop
    v_ex := academia_chat.exercicio_id(v_user, e->>'nome', e->>'grupo');
    n := 0;
    for s in select * from jsonb_array_elements(coalesce(e->'series','[]'::jsonb)) loop
      n := n + 1;
      insert into academia.series(user_id, sessao_id, exercicio_id, ordem_exercicio, numero, carga_kg, reps, feita, feita_em)
      values (v_user, v_sessao, v_ex, i, n, coalesce((s->>'carga')::numeric, 0), coalesce((s->>'reps')::int, 0), true, v_ini);
    end loop;
    i := i + 1;
  end loop;
  return v_sessao;
end $$;

-- Cria/atualiza uma ficha (rotina) pelo chat. Substitui os exercícios da ficha.
-- {"nome":"Treino A","descricao":"Peito e tríceps",
--  "exercicios":[{"nome":"Supino reto com barra","series":4,"reps":"8-10","descanso":90}]}
create or replace function academia_chat.salvar_ficha(p_email text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := academia_chat.uid(p_email); v_ficha uuid; e jsonb; i int := 0;
begin
  if v_user is null then raise exception 'Usuário % não encontrado', p_email; end if;
  select id into v_ficha from academia.fichas
   where user_id = v_user and not excluido and lower(nome) = lower(p_dados->>'nome') limit 1;
  if v_ficha is null then
    insert into academia.fichas(user_id, nome, descricao) values (v_user, p_dados->>'nome', p_dados->>'descricao')
    returning id into v_ficha;
  else
    update academia.fichas set descricao = coalesce(p_dados->>'descricao', descricao) where id = v_ficha;
    update academia.ficha_exercicios set excluido = true where ficha_id = v_ficha and not excluido;
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_dados->'exercicios','[]'::jsonb)) loop
    insert into academia.ficha_exercicios(user_id, ficha_id, exercicio_id, ordem, series, reps_alvo, descanso_seg)
    values (v_user, v_ficha, academia_chat.exercicio_id(v_user, e->>'nome', e->>'grupo'), i,
            coalesce((e->>'series')::int, 3), coalesce(e->>'reps', '10'), coalesce((e->>'descanso')::int, 90));
    i := i + 1;
  end loop;
  return v_ficha;
end $$;

-- Histórico legível (todas as séries feitas)
create or replace view academia_chat.historico as
select u.email, se.id as sessao_id, se.nome as sessao, se.iniciada_em,
       (se.iniciada_em at time zone 'America/Cuiaba')::date as dia,
       ex.nome as exercicio, ex.grupo, sr.numero as serie, sr.carga_kg, sr.reps,
       round(sr.carga_kg * (1 + sr.reps / 30.0), 1) as rm1_estimado, se.origem
from academia.series sr
join academia.sessoes se on se.id = sr.sessao_id and not se.excluido
join academia.exercicios ex on ex.id = sr.exercicio_id
join auth.users u on u.id = sr.user_id
where not sr.excluido and sr.feita;

-- Recordes por exercício
create or replace view academia_chat.recordes as
select email, exercicio, max(carga_kg) as maior_carga, max(rm1_estimado) as melhor_1rm,
       max(iniciada_em) as ultima_vez, count(distinct sessao_id) as sessoes
from academia_chat.historico group by email, exercicio;

revoke all on all tables in schema academia_chat from public, anon, authenticated;
revoke execute on all functions in schema academia_chat from public, anon, authenticated;
