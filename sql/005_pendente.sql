-- Dados pré-cadastrados pelo assistente para quem AINDA não criou conta.
-- Quando a pessoa se cadastrar com esse e-mail, o perfil/peso é aplicado automaticamente.
create table if not exists academia_chat.perfil_pendente (
  email text primary key,
  dados jsonb not null,          -- mesmo formato de academia_chat.salvar_perfil
  criado_em timestamptz not null default now()
);
revoke all on academia_chat.perfil_pendente from public, anon, authenticated;

create or replace function academia_chat.aplicar_pendente() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  select dados into d from academia_chat.perfil_pendente where lower(email) = lower(new.email);
  if d is not null then
    perform academia_chat.salvar_perfil(new.email, d);
    delete from academia_chat.perfil_pendente where lower(email) = lower(new.email);
  end if;
  return new;
exception when others then
  raise warning 'aplicar_pendente falhou: %', sqlerrm;  -- nunca bloqueia o cadastro
  return new;
end $$;

drop trigger if exists academia_aplicar_pendente on auth.users;
create trigger academia_aplicar_pendente after insert on auth.users
  for each row execute function academia_chat.aplicar_pendente();
revoke execute on function academia_chat.aplicar_pendente() from public, anon, authenticated;
