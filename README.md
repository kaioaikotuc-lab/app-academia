# App Academia — controle de treino de musculação

PWA (app web instalável) em português, mobile-first, tema escuro. Sem build: HTML + JS puro.

- **URL:** https://kaioaikotuc-lab.github.io/app-academia/
- **Hospedagem:** GitHub Pages (repo `kaioaikotuc-lab/app-academia`, pasta `docs/`, branch `main`) — grátis.
- **Banco + login:** Supabase, projeto `clinica-system` (`swiquyzwmmdoayungrnd`, plano free), em um
  **schema isolado `academia`** (não mexe nas tabelas da clínica). RLS: cada usuário só acessa os próprios dados.
  (Motivo: o plano free do Supabase permite só 2 projetos ativos e os dois já existiam.)

## Estrutura
```
docs/                 app publicado (GitHub Pages)
  index.html styles.css manifest.webmanifest sw.js icons/
  config.js           URL e chave pública do Supabase
  store.js            dados locais (IndexedDB) + fila offline + sincronização
  app.js              telas e ações
  vendor/supabase.js  supabase-js v2 (local, para funcionar offline)
sql/                  migrações já aplicadas (001..005), em ordem
supabase/functions/academia-cadastro/   Edge Function de cadastro (cria usuário já confirmado)
scripts/registrar_treino.py   gera SQL para o assistente registrar/ler dados pelo chat
tests/e2e.py          teste ponta a ponta (Playwright + Chrome headless)
```

## Como funciona a sincronização (offline)
Tudo é gravado primeiro no aparelho (IndexedDB) e entra numa fila. Com internet, `store.js` faz
`upsert` das pendências (IDs UUID gerados no aparelho) e baixa o que mudou no servidor
(`atualizado_em > último pull`) — inclusive o que o assistente gravou pelo chat. Exclusões são
"soft delete" (`excluido = true`). O primeiro login precisa de internet.

## Tabelas (schema `academia`)
| tabela | colunas principais |
|---|---|
| `perfis` | `id`(=user_id), `nome`, `idade`, `idade_em`, `altura_cm`, `sexo`, `meta_peso_kg` |
| `pesagens` | `id`, `user_id`, `data`, `peso_kg`, `notas` |
| `exercicios` | `id`, `user_id` (NULL = biblioteca padrão), `nome`, `grupo` |
| `fichas` | `id`, `user_id`, `nome`, `descricao`, `ordem` |
| `ficha_exercicios` | `id`, `ficha_id`, `exercicio_id`, `ordem`, `series`, `reps_alvo`, `descanso_seg` |
| `sessoes` | `id`, `user_id`, `ficha_id`, `nome`, `iniciada_em`, `finalizada_em`, `notas`, `origem` ('app'/'chat') |
| `series` | `id`, `user_id`, `sessao_id`, `exercicio_id`, `ordem_exercicio`, `numero`, `carga_kg`, `reps`, `feita`, `feita_em` |

Todas têm `excluido`, `criado_em`, `atualizado_em` (trigger).

## Assistente: ler e gravar pelo chat
Use o Supabase MCP `execute_sql` no projeto `swiquyzwmmdoayungrnd`. Funções no schema privado
`academia_chat` (não exposto na API pública):

```sql
-- registrar treino
select academia_chat.registrar_sessao('EMAIL', '{
  "data":"2026-11-10T07:30:00-04:00", "nome":"Treino A", "ficha":"Treino A", "notas":"opcional",
  "exercicios":[
    {"nome":"Supino reto com barra","series":[{"carga":60,"reps":10},{"carga":62.5,"reps":8}]},
    {"nome":"Tríceps corda","grupo":"Tríceps","series":[{"carga":25,"reps":12}]}
  ]}'::jsonb);
-- peso corporal (1 por dia; substitui o do mesmo dia)
select academia_chat.registrar_peso('EMAIL', 70.0, '2026-11-10');
-- perfil (+ pesagem opcional)
select academia_chat.salvar_perfil('EMAIL', '{"idade":28,"altura_cm":186,"peso_kg":70,"data":"2026-11-10"}');
-- criar/atualizar ficha (substitui os exercícios dela)
select academia_chat.salvar_ficha('EMAIL', '{"nome":"Treino A","descricao":"Peito/Tríceps",
  "exercicios":[{"nome":"Supino reto com barra","series":4,"reps":"8-10","descanso":90}]}');
-- leitura
select * from academia_chat.perfil    where email='EMAIL';  -- idade atual, altura, peso atual, IMC
select * from academia_chat.historico where email='EMAIL' order by iniciada_em desc;  -- séries
select * from academia_chat.recordes  where email='EMAIL';  -- PR e 1RM estimado por exercício
-- pré-cadastro para quem ainda não tem conta (aplicado automaticamente no cadastro)
insert into academia_chat.perfil_pendente(email,dados) values ('EMAIL','{"idade":28,"altura_cm":186,"peso_kg":70,"data":"2026-11-10"}')
  on conflict (email) do update set dados=excluded.dados;
```
Nomes de exercício são procurados sem diferenciar maiúsculas (exato, depois "contém"); se não
existir, é criado como exercício do usuário. Atalho: `python3 scripts/registrar_treino.py --help`
imprime o SQL pronto.

Inserção direta (sem função) também funciona — sempre preencha `user_id`:
```sql
with u as (select id from auth.users where email='EMAIL'),
s as (insert into academia.sessoes(user_id,nome,iniciada_em,finalizada_em,origem)
      select id,'Treino A','2026-11-10 07:30-04','2026-11-10 08:30-04','chat' from u returning id,user_id)
insert into academia.series(user_id,sessao_id,exercicio_id,numero,carga_kg,reps,feita)
select s.user_id, s.id, (select id from academia.exercicios where nome='Supino reto com barra' and user_id is null), 1, 60, 10, true from s;
```

## Evoluir
- Novas colunas/tabelas: crie `sql/006_*.sql` e aplique com `apply_migration`; se for tabela nova
  sincronizada, adicione em `TABELAS` no `store.js` (respeitando a ordem das FKs) e crie RLS `dono`.
- Mudou arquivos do app: aumente `VERSAO` em `docs/sw.js` (e `config.js`), commit e push → Pages publica sozinho.
- Teste: `cd docs && python3 -m http.server 8765` e `python3 tests/e2e.py`.

## Conta de demonstração e testes
- Conta demo: `demo.academia.kaio@example.com` (senha só em `conta-teste.txt`, fora do git).
- Semana simulada 02–08/11/2026: `tests/demo_fase1.py`, `demo_fase1b.py`, `demo_fase2.py`, `demo_fase3.py` (app publicado, 390px), treino de sábado pelo chat, `sql/demo_backdate.sql` (move as sessões feitas "hoje" para as datas da semana), `tests/demo_fase4.py` (conferência + screenshots em `screens/`).
