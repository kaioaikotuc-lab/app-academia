// Cadastro sem e-mail de confirmação: cria o usuário já confirmado.
// O app chama esta função e depois faz login com email+senha normalmente.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
  let body: { email?: string; senha?: string; nome?: string };
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido" }, 400);
  if (senha.length < 6) return json({ erro: "A senha precisa ter pelo menos 6 caracteres" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    user_metadata: { nome: body.nome ?? "", app: "academia" },
  });
  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? "Este e-mail já tem conta. Use Entrar." : error.message;
    return json({ erro: msg }, 400);
  }
  return json({ ok: true, id: data.user?.id });
});
