# Fase 4: conferência e screenshots finais + CSV + cadastro/troca de senha (conta descartável) + PWA
import sys, time, csv, io
sys.path.insert(0, "tests"); from demo_lib import *
R = {}
with sync_playwright() as p:
    a = App(p); pg = a.pg; abrir(a); time.sleep(3); pg.reload(); a.esperar_sync(); time.sleep(1)
    a.nav("treinar"); a.shot("02-treinar")
    a.nav("historico"); R["historico"] = a.main()[:700]; a.shot("09-historico", full=True)
    pg.locator(".card", has_text="💬").first.click(); time.sleep(0.6); R["chat"] = a.main()[:300]; a.shot("10-sessao-chat", full=True)
    a.nav("historico"); pg.locator(".card", has_text="Treino A").first.click(); time.sleep(0.6); a.shot("08-sessao-detalhe", full=True)
    a.nav("progresso"); R["evolucao"] = a.main()[:900]; a.shot("11-evolucao-lista", full=True)
    pg.locator(".card", has_text="Supino reto com barra").first.click(); time.sleep(0.6)
    R["supino"] = pg.inner_text(".kpis").replace("\n", " "); R["supino_hist"] = a.main()[-260:]; a.shot("12-evolucao-supino", full=True)
    a.nav("perfil"); R["perfil"] = pg.inner_text(".kpis").replace("\n", " "); R["perfil_txt"] = a.main()[:600]; a.shot("14-perfil-peso", full=True)
    with pg.expect_download() as d: pg.click("[data-act=exportar]")
    path = "/workspace/app-academia/screens/treinos-demo.csv"; d.value.save_as(path)
    rows = list(csv.reader(io.StringIO(open(path, encoding="utf-8-sig").read()), delimiter=";"))
    R["csv"] = f"{len(rows)-1} linhas; cabeçalho={rows[0]}; ex={rows[1]}"
    a.go("exercicios"); a.shot("05-exercicios")
    a.nav("fichas"); a.shot("03-fichas")
    R["manifest"] = pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json()).then(m=>[m.display,m.icons.length,m.start_url])")
    R["sw"] = pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active))")
    R["erros"] = a.erros; a.ctx.close()
    # cadastro pela tela + trocar senha + login com a nova (conta descartável)
    b = App(p, "/tmp/pw-tmp"); q = b.pg; q.goto(URL); q.wait_for_selector("#f-login")
    q.fill("input[name=email]", "descartavel.academia@example.com"); q.fill("input[name=senha]", "Temp12345")
    q.click("button[value=criar]"); q.wait_for_selector("nav button.on", timeout=20000); b.esperar_sync()
    b.nav("perfil"); b.respostas = ["Nova12345"]; q.click("[data-act=senha]"); time.sleep(2); R["trocar_senha"] = q.inner_text("#toast")
    q.click("[data-act=sair]"); time.sleep(2)
    q.fill("input[name=email]", "descartavel.academia@example.com"); q.fill("input[name=senha]", "Nova12345"); q.click("button[value=entrar]")
    q.wait_for_selector("nav button.on", timeout=15000); R["login_nova_senha"] = "ok"
    q.click("nav button[data-go=perfil]"); time.sleep(0.5); q.click("[data-act=sair]"); time.sleep(1)
    q.fill("input[name=email]", "descartavel.academia@example.com"); q.fill("input[name=senha]", "Temp12345"); q.click("button[value=criar]"); time.sleep(3)
    R["cadastro_duplicado"] = q.inner_text("#f-login .erro")
    b.ctx.close()
for k, v in R.items(): print(k, "=>", v if not isinstance(v, str) else v.replace("\n", " | "))
