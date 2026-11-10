# Testa: cadastro pela tela, perfil pré-carregado, service worker, abrir offline e gravar offline -> sincroniza ao voltar.
import time, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}); pg = ctx.new_page()
    er = []; pg.on("pageerror", lambda e: er.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto(URL)
    pg.fill("input[name=email]", "teste2.academia.bot@example.com"); pg.fill("input[name=senha]", "Teste12345")
    pg.click("button[value=criar]"); pg.wait_for_selector("nav button.on", timeout=20000); time.sleep(4)
    pg.click("nav button[data-go=perfil]"); time.sleep(1)
    print("perfil:", pg.inner_text(".kpis").replace("\n", " "))
    print("sw controlando:", pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)"))
    pg.reload(); time.sleep(2)
    print("controller:", pg.evaluate("!!navigator.serviceWorker.controller"))
    ctx.set_offline(True)
    pg.reload(); time.sleep(3)
    print("offline abriu:", pg.is_visible("nav"), pg.get_attribute("#sync", "title"))
    pg.click("nav button[data-go=perfil]"); pg.fill("#novo-peso", "79"); pg.click("[data-act=add-peso]"); time.sleep(1)
    print("offline status:", pg.get_attribute("#sync", "title"))
    ctx.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))"); time.sleep(5)
    print("online status:", pg.get_attribute("#sync", "title"))
    print("erros:", er); b.close()
