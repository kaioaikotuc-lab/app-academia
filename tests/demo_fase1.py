# Fase 1: login, perfil, exercícios, fichas
import time, sys
sys.path.insert(0, "tests"); from demo_lib import *
E, S = cred(); R = {}
with sync_playwright() as p:
    a = App(p); pg = a.pg
    pg.goto(URL); pg.wait_for_selector("#f-login"); a.shot("01-login")
    pg.fill("input[name=email]", E); pg.fill("input[name=senha]", "senhaerrada")
    pg.click("button[value=entrar]"); time.sleep(2); R["login_senha_errada"] = pg.inner_text("#f-login .erro")
    pg.fill("input[name=senha]", S); pg.click("button[value=entrar]"); pg.wait_for_selector("nav button.on"); a.esperar_sync()
    R["tela_inicial"] = a.main()[:120]
    # perfil
    a.nav("perfil")
    for campo, v in (("nome", "Kaio (demo)"), ("idade", "28"), ("altura_cm", "186"), ("meta_peso_kg", "75")):
        el = pg.locator(f"[data-perfil={campo}]"); el.fill(v); el.dispatch_event("change"); time.sleep(0.3)
    pg.fill("#novo-peso", "70"); pg.click("[data-act=add-peso]"); time.sleep(0.5)
    pg.mouse.click(5, 300); time.sleep(0.5)
    R["perfil_kpis"] = pg.inner_text(".kpis").replace("\n", " ")
    # exercícios: busca, personalizado, edição
    a.nav("exercicios") if pg.query_selector("nav button[data-go=exercicios]") else pg.click(".fab-ex"); time.sleep(0.5)
    R["biblioteca_itens"] = pg.locator(".lista .item").count()
    a.respostas = ["Remada máquina articulada", "Costas"]; pg.click("[data-act=novo-ex]"); time.sleep(0.5)
    a.respostas = ["Elevação lateral máquina", "Ombros"]; pg.click("[data-act=novo-ex]"); time.sleep(0.5)
    pg.fill("#busca-ex", "máquina"); time.sleep(0.6)
    R["busca_maquina"] = a.main().count("máquina")
    a.shot("05-exercicios-busca")
    a.respostas = ["Elevação lateral na máquina", "Ombros"]
    pg.locator(".item", has_text="Elevação lateral máquina").locator("[data-act=editar-ex]").click(); time.sleep(0.5)
    R["editado"] = "Elevação lateral na máquina" in a.main()
    pg.fill("#busca-ex", ""); time.sleep(0.4)
    # fichas: nova + excluir, modelo ABC, edição
    a.nav("fichas")
    a.respostas = ["Ficha teste (apagar)"]; pg.click("[data-act=nova-ficha]"); time.sleep(0.6)
    pg.click("[data-act=rm-ficha]"); time.sleep(0.6)
    pg.click("[data-act=modelo-abc]"); time.sleep(0.8)
    R["fichas"] = a.main()
    # Treino A: supino reto 4x8-10 120s; inclinado 3x8-10
    pg.locator(".card", has_text="Treino A").click(); time.sleep(0.6)
    d = pg.locator("[data-ficha=descricao]"); d.fill("Peito e tríceps — hipertrofia"); d.dispatch_event("change"); time.sleep(0.3)
    def item(ex, campo, v):
        b = a.bloco(ex) if False else pg.locator(".exbloco", has_text=ex).first
        el = b.locator(f"[data-item={campo}]"); el.fill(v); el.dispatch_event("change"); time.sleep(0.3)
    item("Supino reto com barra", "series", "4"); item("Supino reto com barra", "reps_alvo", "8-10"); item("Supino reto com barra", "descanso_seg", "120")
    item("Supino inclinado com halteres", "reps_alvo", "8-10")
    # reordenar: crucifixo sobe, depois desce de novo
    pg.locator(".exbloco", has_text="Crucifixo").locator("[data-act=mover][data-v='-1']").click(); time.sleep(0.4)
    R["ordem_apos_mover"] = [t.split(". ",1)[1] for t in pg.locator(".exbloco .exhead .t").all_inner_texts()]
    pg.locator(".exbloco", has_text="Crucifixo").locator("[data-act=mover][data-v='1']").click(); time.sleep(0.4)
    pg.mouse.click(5, 120); time.sleep(0.4); a.shot("04-ficha-A-edicao", full=True)
    # Treino B: adiciona exercício personalizado; remove remada baixa? (mantém) 
    a.nav("fichas"); pg.locator(".card", has_text="Treino B").click(); time.sleep(0.6)
    item("Puxada frontal", "series", "4"); item("Remada curvada", "series", "4")
    pg.click("[data-act=add-ex-ficha]"); pg.fill("#modal-busca", "articulada"); time.sleep(0.4)
    pg.locator("#modal-lista [data-pick]").first.click(); time.sleep(0.5)
    item("Remada máquina articulada", "reps_alvo", "10-12")
    # Treino C: troca "Elevação lateral" por "Elevação lateral na máquina"; agachamento 4x8 120s; panturrilha 4x15
    a.nav("fichas"); pg.locator(".card", has_text="Treino C").click(); time.sleep(0.6)
    item("Agachamento livre", "series", "4"); item("Agachamento livre", "reps_alvo", "8"); item("Agachamento livre", "descanso_seg", "120")
    item("Panturrilha em pé", "series", "4"); item("Panturrilha em pé", "reps_alvo", "15"); item("Panturrilha em pé", "descanso_seg", "60")
    pg.locator(".exbloco", has_text="Elevação lateral").locator("[data-act=rm-item]").click(); time.sleep(0.4)
    pg.click("[data-act=add-ex-ficha]"); pg.fill("#modal-busca", "Elevação lateral na"); time.sleep(0.4)
    pg.locator("#modal-lista [data-pick]").first.click(); time.sleep(0.5)
    item("Elevação lateral na máquina", "reps_alvo", "12-15")
    a.nav("fichas"); a.shot("03-fichas")
    R["fichas_final"] = a.main()
    # modal instalar
    a.nav("perfil"); pg.click("[data-act=instalar]"); time.sleep(0.4); a.shot("13-instalar"); pg.click("[data-fechar]")
    R["sync"] = a.esperar_sync(); R["erros"] = a.erros; R["dialogs"] = a.log
    a.ctx.close()
for k, v in R.items(): print(k, "=>", v if not isinstance(v, str) else v.replace("\n", " | ")[:400])
