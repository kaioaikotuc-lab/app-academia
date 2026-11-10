# Fase 3: sex 06 — Treino A pelo app: sugestão da última carga, botões +/−, cronômetro, recorde, offline+sync
import sys, time
sys.path.insert(0, "tests"); from demo_lib import *
R = {}
with sync_playwright() as p:
    a = App(p); pg = a.pg; R["versao"] = abrir(a); time.sleep(2)
    a.nav("treinar"); a.shot("02-treinar-inicio")
    pg.locator("[data-act=iniciar]", has_text="Peito").first.click(); pg.wait_for_selector(".serie .check"); time.sleep(0.6)
    R["sugestao_supino"] = a.valores("Supino reto com barra"); R["sugestao_inclinado"] = a.valores("Supino inclinado com halteres")
    R["sub_supino"] = a.bloco("Supino reto com barra").locator(".exhead .sub").inner_text()
    # progressão com o botão + (2,5 kg) em cada série do supino
    for i in range(4):
        a.bloco("Supino reto com barra").locator(".serie:not(.cab)").nth(i).locator("[data-c=carga_kg][data-v='2.5']").click(); time.sleep(0.25)
    a.bloco("Supino reto com barra").locator(".serie:not(.cab)").nth(0).locator(".check").click(); time.sleep(0.4)
    R["toast_pr"] = pg.inner_text("#toast"); a.shot("06-treino-ativo-recorde")
    # cronômetro: +15, −15
    t0 = pg.inner_text("#timer-txt"); pg.click("#t-mais"); time.sleep(0.3); t1 = pg.inner_text("#timer-txt"); pg.click("#t-menos"); pg.click("#t-menos"); time.sleep(0.3)
    R["timer"] = [t0, t1, pg.inner_text("#timer-txt")]
    a.shot("07-cronometro")
    # resto do supino
    for i in range(1, 4): a.bloco("Supino reto com barra").locator(".serie:not(.cab)").nth(i).locator(".check").click(); time.sleep(0.25)
    # OFFLINE no meio do treino
    a.ctx.set_offline(True); time.sleep(0.5)
    a.preencher("Supino inclinado com halteres", [(16,9),(16,8),(16,8)])
    a.preencher("Crucifixo com halteres", [(10,12),(10,12),(10,11)])
    a.bloco("Crucifixo com halteres").locator(".serie:not(.cab)").nth(2).locator("[data-c=reps][data-v='1']").click(); time.sleep(0.3)
    a.preencher("Tríceps na polia (pulley)", [(22.5,12),(22.5,11),(22.5,10)])
    a.preencher("Tríceps testa", [(15,10),(15,10),(15,10)])
    R["offline_status"] = pg.get_attribute("#sync", "title"); R["fila_offline"] = pg.evaluate("Store.fila.length")
    pg.click("[data-act=finalizar]"); time.sleep(1)
    R["detalhe"] = a.main()[:500]
    a.ctx.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))")
    R["sync_volta"] = a.esperar_sync(); R["fila_depois"] = pg.evaluate("Store.fila.length")
    # treino livre: iniciar e descartar
    a.nav("treinar"); pg.click("[data-act=iniciar-livre]"); time.sleep(0.6)
    R["livre"] = a.main()[:80]; pg.click("[data-act=cancelar-sessao]"); time.sleep(0.6)
    R["apos_descartar"] = a.main()[:60]
    R["erros"] = a.erros; a.ctx.close()
for k, v in R.items(): print(k, "=>", v if not isinstance(v, str) else v.replace("\n", " | ")[:500])
