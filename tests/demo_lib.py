import re, time, json
from playwright.sync_api import sync_playwright
URL = "https://kaioaikotuc-lab.github.io/app-academia/"
def cred():
    t = open("/workspace/app-academia/conta-teste.txt").read()
    return re.search(r"E-mail: (\S+)", t).group(1), re.search(r"Senha: (\S+)", t).group(1)
class App:
    def __init__(self, p, perfil_dir="/tmp/pw-final"):
        self.ctx = p.chromium.launch_persistent_context(perfil_dir, channel="chrome", headless=True,
            viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
        self.pg = self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()
        self.respostas, self.erros, self.log = [], [], []
        self.pg.on("pageerror", lambda e: self.erros.append(str(e)))
        self.pg.on("console", lambda m: m.type == "error" and self.erros.append(m.text))
        self.pg.on("dialog", self._dlg)
    def _dlg(self, d):
        self.log.append(f"[{d.type}] {d.message[:60]}")
        if d.type == "prompt" and self.respostas: d.accept(self.respostas.pop(0))
        else: d.accept()
    def go(self, h): self.pg.evaluate(f"location.hash={json.dumps(h)}"); time.sleep(0.6)
    def nav(self, n): self.pg.click(f"nav button[data-go={n}]"); time.sleep(0.6)
    def shot(self, nome, full=False): self.pg.screenshot(path=f"/workspace/app-academia/screens/{nome}.png", full_page=full)
    def main(self): return self.pg.inner_text("main")
    def esperar_sync(self, t=20):
        for _ in range(t * 2):
            if (self.pg.get_attribute("#sync", "class") or "").endswith(" ok") and self.pg.evaluate("Store.fila.length") == 0: return True
            time.sleep(0.5)
        return False
    def bloco(self, ex):
        return self.pg.locator(".exbloco", has=self.pg.locator(".exhead .t", has_text=re.compile("^" + re.escape(ex) + "$"))).first
    def valores(self, ex):
        b = self.bloco(ex); rows = b.locator(".serie:not(.cab)")
        return [(rows.nth(i).locator("input").nth(0).input_value(), rows.nth(i).locator("input").nth(1).input_value()) for i in range(rows.count())]
    def preencher(self, ex, vals, marcar=True):
        for i, (kg, reps) in enumerate(vals):
            while self.bloco(ex).locator(".serie:not(.cab)").count() <= i:
                self.bloco(ex).locator("[data-act=add-serie]").click(); time.sleep(0.3)
            row = self.bloco(ex).locator(".serie:not(.cab)").nth(i)
            for j, v in ((0, kg), (1, reps)):
                inp = row.locator("input").nth(j)
                if inp.input_value() != str(v):
                    inp.fill(str(v)); inp.dispatch_event("change"); time.sleep(0.15)
            if marcar:
                row = self.bloco(ex).locator(".serie:not(.cab)").nth(i)
                if "feita" not in (row.get_attribute("class") or ""):
                    row.locator(".check").click(); time.sleep(0.25)
def abrir(a):
    pg = a.pg; pg.goto(URL); time.sleep(2)
    if pg.is_visible("#f-login"):
        E, S = cred(); pg.fill("input[name=email]", E); pg.fill("input[name=senha]", S); pg.click("button[value=entrar]")
    pg.wait_for_selector("nav button.on"); a.esperar_sync()
    return pg.evaluate("APP_CONFIG.VERSAO")
def item(a, ex, campo, v):
    el = a.pg.locator(".exbloco", has_text=ex).first.locator(f"[data-item={campo}]")
    el.fill(v); el.dispatch_event("change"); time.sleep(0.3)
