# Fase 2: corrige perfil, testa mover, treinos de seg 02, ter 03, qua 04 pelo app
import time, sys, re
sys.path.insert(0, "tests"); from demo_lib import *
R = {}
SEG_A = {"Supino reto com barra": [(40,10),(40,9),(40,8),(40,8)], "Supino inclinado com halteres": [(14,10),(14,9),(14,8)],
         "Crucifixo com halteres": [(10,12),(10,12),(10,11)], "Tríceps na polia (pulley)": [(20,12),(20,12),(20,10)], "Tríceps testa": [(15,10),(15,10),(15,9)]}
TER_B = {"Puxada frontal (pulldown)": [(45,10),(45,10),(45,9),(45,8)], "Remada curvada com barra": [(30,10),(30,10),(30,9),(30,9)],
         "Remada baixa no cabo": [(40,12),(40,11),(40,10)], "Rosca direta com barra": [(20,10),(20,9),(20,8)], "Rosca martelo": [(10,12),(10,11),(10,10)],
         "Remada máquina articulada": [(35,12),(35,11),(35,10)]}
QUA_C = {"Agachamento livre": [(40,10),(45,8),(45,8),(45,8),(40,10)], "Leg press 45°": [(100,12),(100,12),(100,11)],
         "Cadeira extensora": [(35,12),(35,12)], "Mesa flexora": [(30,12),(30,12),(30,10)], "Desenvolvimento com halteres": [(12,10),(12,9),(12,8)],
         "Panturrilha em pé": [(40,15),(40,15),(40,14),(40,13)], "Elevação lateral na máquina": [(20,15),(20,13),(20,12)]}
def treino(a, ficha_desc, plano, extra=None, shot=None):
    pg = a.pg; a.nav("treinar")
    pg.locator("[data-act=iniciar]", has_text=ficha_desc).first.click(); pg.wait_for_selector(".serie .check"); time.sleep(0.5)
    if extra: extra(a)
    for ex, vals in plano.items(): a.preencher(ex, vals)
    if shot: pg.mouse.click(5, 150); time.sleep(0.3); a.shot(shot)
    pg.click("[data-act=finalizar]"); time.sleep(1)
    return a.main()
with sync_playwright() as p:
    a = App(p); pg = a.pg
    pg.goto(URL); pg.wait_for_selector("nav button.on"); a.esperar_sync()
    a.nav("perfil")
    for campo, v in (("idade", "28"), ("meta_peso_kg", "75")):
        el = pg.locator(f"[data-perfil={campo}]"); el.fill(v); el.dispatch_event("change"); time.sleep(0.3)
    pg.mouse.click(5, 300); a.esperar_sync(); time.sleep(1)
    R["perfil_kpis"] = pg.inner_text(".kpis").replace("\n", " ")
    a.nav("fichas"); pg.locator(".card", has_text="Treino A").click(); time.sleep(0.6)
    pg.locator(".exbloco", has_text="Crucifixo").locator("[data-act=mover][data-v='-1']").click(); time.sleep(0.5)
    R["ordem_A"] = [t.split(". ",1)[1] for t in pg.locator(".exbloco .exhead .t").all_inner_texts()]
    # seg 02 — Treino A
    R["seg"] = treino(a, "Peito", SEG_A)[:200]
    a.shot("08-sessao-detalhe", full=True)
    # ter 03 — Treino B
    R["ter"] = treino(a, "Costas", TER_B)[:200]
    # qua 04 — Treino C, com +série, −série, + exercício na hora
    def extra_c(a):
        pg = a.pg
        a.bloco("Agachamento livre").locator("[data-act=add-serie]").click(); time.sleep(0.3)
        a.bloco("Cadeira extensora").locator("[data-act=rm-serie]").click(); time.sleep(0.3)
        pg.click("[data-act=add-ex-sessao]"); pg.fill("#modal-busca", "Abdominal supra"); time.sleep(0.4)
        pg.locator("#modal-lista [data-pick]").first.click(); time.sleep(0.5)
        R["c_series_agach"] = a.bloco("Agachamento livre").locator(".serie:not(.cab)").count()
        R["c_series_ext"] = a.bloco("Cadeira extensora").locator(".serie:not(.cab)").count()
    QUA_C["Abdominal supra"] = [(0,20),(0,20),(0,15)]
    R["qua"] = treino(a, "Pernas", QUA_C, extra=extra_c)[:200]
    R["sync"] = a.esperar_sync(); R["erros"] = a.erros
    a.ctx.close()
for k, v in R.items(): print(k, "=>", v if not isinstance(v, str) else v.replace("\n", " | ")[:300])
