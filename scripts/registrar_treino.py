#!/usr/bin/env python3
"""
Gera o SQL para o assistente registrar dados do Kaio pelo chat.
O SQL gerado deve ser executado com a ferramenta Supabase MCP `execute_sql`
(projeto swiquyzwmmdoayungrnd). Não precisa de senha: roda com acesso administrativo.

Exemplos:
  # sessão de treino (séries como carga x reps)
  python3 registrar_treino.py treino --email kaio@x.com --nome "Treino A" --data 2026-11-10T07:30 \
      --ex "Supino reto com barra=60x10,60x8,62.5x6" --ex "Tríceps corda=25x12,25x12"
  # peso corporal
  python3 registrar_treino.py peso --email kaio@x.com --kg 70 --data 2026-11-10
  # perfil
  python3 registrar_treino.py perfil --email kaio@x.com --idade 28 --altura 186 --kg 70
  # ficha (rotina): nome=séries x reps
  python3 registrar_treino.py ficha --email kaio@x.com --nome "Treino A" --ex "Supino reto com barra=4x8-10"
  # consultas prontas
  python3 registrar_treino.py ver --email kaio@x.com
"""
import argparse, json

def q(s):  # literal SQL seguro
    return "'" + str(s).replace("'", "''") + "'"

def tz(d):
    if d and "T" in d and not any(c in d[10:] for c in "+-Z"):
        return d + ":00-04:00" if d.count(":") == 1 else d + "-04:00"  # America/Cuiaba
    return d

def parse_series(txt):
    out = []
    for p in txt.split(","):
        c, r = p.strip().lower().split("x")
        out.append({"carga": float(c.replace(",", ".")), "reps": int(r)})
    return out

ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
t = sub.add_parser("treino"); t.add_argument("--email", required=True); t.add_argument("--nome", default="Treino")
t.add_argument("--ficha"); t.add_argument("--data"); t.add_argument("--notas"); t.add_argument("--ex", action="append", default=[])
p = sub.add_parser("peso"); p.add_argument("--email", required=True); p.add_argument("--kg", type=float, required=True); p.add_argument("--data")
f = sub.add_parser("perfil"); f.add_argument("--email", required=True); f.add_argument("--nome"); f.add_argument("--idade", type=int)
f.add_argument("--altura", type=float, help="cm"); f.add_argument("--kg", type=float); f.add_argument("--data")
fi = sub.add_parser("ficha"); fi.add_argument("--email", required=True); fi.add_argument("--nome", required=True)
fi.add_argument("--descricao"); fi.add_argument("--ex", action="append", default=[])
v = sub.add_parser("ver"); v.add_argument("--email", required=True)
a = ap.parse_args()

if a.cmd == "treino":
    d = {"nome": a.nome, "exercicios": []}
    if a.ficha: d["ficha"] = a.ficha
    if a.data: d["data"] = tz(a.data)
    if a.notas: d["notas"] = a.notas
    for e in a.ex:
        nome, series = e.split("=", 1)
        d["exercicios"].append({"nome": nome.strip(), "series": parse_series(series)})
    print(f"select academia_chat.registrar_sessao({q(a.email)}, {q(json.dumps(d, ensure_ascii=False))}::jsonb);")
elif a.cmd == "peso":
    print(f"select academia_chat.registrar_peso({q(a.email)}, {a.kg}, {q(a.data) + '::date' if a.data else 'null'});")
elif a.cmd == "perfil":
    d = {k: v for k, v in {"nome": a.nome, "idade": a.idade, "altura_cm": a.altura, "peso_kg": a.kg, "data": a.data}.items() if v is not None}
    print(f"select academia_chat.salvar_perfil({q(a.email)}, {q(json.dumps(d, ensure_ascii=False))}::jsonb);")
elif a.cmd == "ficha":
    d = {"nome": a.nome, "exercicios": []}
    if a.descricao: d["descricao"] = a.descricao
    for e in a.ex:
        nome, sr = e.split("=", 1); s, r = sr.lower().split("x", 1)
        d["exercicios"].append({"nome": nome.strip(), "series": int(s), "reps": r})
    print(f"select academia_chat.salvar_ficha({q(a.email)}, {q(json.dumps(d, ensure_ascii=False))}::jsonb);")
elif a.cmd == "ver":
    e = q(a.email)
    print(f"select * from academia_chat.perfil where email={e};")
    print(f"select dia, sessao, exercicio, serie, carga_kg, reps, rm1_estimado from academia_chat.historico where email={e} order by iniciada_em desc, exercicio, serie limit 60;")
    print(f"select * from academia_chat.recordes where email={e} order by exercicio;")
