-- (só para a conta de demonstração) move as sessões feitas hoje pelo app para as datas da semana simulada
with u as (select academia_chat.uid('demo.academia.kaio@example.com') id),
alvo(nome, ini, dur) as (values
  ('Treino A', timestamptz '2026-11-02 18:30-04', 62),
  ('Treino B', timestamptz '2026-11-03 18:35-04', 68),
  ('Treino C', timestamptz '2026-11-04 18:20-04', 75)),
s as (
  update academia.sessoes se set iniciada_em = a.ini, finalizada_em = a.ini + make_interval(mins => a.dur)
  from alvo a, u where se.user_id = u.id and not se.excluido and se.nome = a.nome and se.origem = 'app'
    and se.iniciada_em > '2026-11-10' returning se.id, se.iniciada_em)
update academia.series sr set feita_em = s.iniciada_em + make_interval(mins => sr.ordem_exercicio * 9 + sr.numero * 2)
from s where sr.sessao_id = s.id and sr.feita;
