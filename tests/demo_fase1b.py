import sys, time
sys.path.insert(0, "tests"); from demo_lib import *
R = {}
with sync_playwright() as p:
    a = App(p); pg = a.pg; R["versao"] = abrir(a)
    a.nav("fichas"); pg.locator(".card", has_text="Treino A").click(); time.sleep(0.6)
    item(a, "Supino reto com barra", "series", "4"); item(a, "Supino reto com barra", "descanso_seg", "120")
    for ex in ("Crucifixo", "Tríceps na polia", "Tríceps testa"): item(a, ex, "reps_alvo", "10-12")
    pg.mouse.click(5, 120); time.sleep(0.5)
    a.nav("fichas"); pg.locator(".card", has_text="Treino B").click(); time.sleep(0.6)
    item(a, "Puxada frontal", "reps_alvo", "8-10"); item(a, "Remada curvada", "series", "4"); item(a, "Remada curvada", "reps_alvo", "8-10")
    for ex in ("Remada baixa", "Rosca direta", "Rosca martelo"): item(a, ex, "reps_alvo", "10-12")
    pg.mouse.click(5, 120); time.sleep(0.5)
    a.nav("fichas"); pg.locator(".card", has_text="Treino C").click(); time.sleep(0.6)
    item(a, "Agachamento livre", "reps_alvo", "8-10")
    item(a, "Panturrilha em pé", "series", "4"); item(a, "Panturrilha em pé", "descanso_seg", "60")
    for ex in ("Leg press", "Cadeira extensora", "Mesa flexora", "Desenvolvimento"): item(a, ex, "reps_alvo", "10-12")
    pg.mouse.click(5, 120); time.sleep(0.5)
    pg.locator(".exbloco", has_text="Elevação lateral na máquina").locator("[data-act=mover][data-v='-1']").click(); time.sleep(0.5)
    R["ordem_C"] = pg.locator(".exbloco .exhead .t").all_inner_texts()
    a.shot("04-ficha-C-edicao", full=True)
    R["sync"] = a.esperar_sync(); R["erros"] = a.erros; a.ctx.close()
print(R)
