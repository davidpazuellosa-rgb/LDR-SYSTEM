// Envio de e-mail via Resend (https://resend.com) usando só fetch (sem dependência).
// Best-effort: se RESEND_API_KEY não estiver configurada, retorna { sent:false } e o
// fluxo segue (o admin copia o link). Configure no Vercel:
//   RESEND_API_KEY = re_xxx
//   EMAIL_FROM     = "SASI LDR Hub <convites@seu-dominio.com>"  (domínio verificado no Resend)
// Sem domínio verificado, use o remetente de teste do Resend (só envia p/ seu próprio e-mail):
//   EMAIL_FROM     = "SASI LDR Hub <onboarding@resend.dev>"

type SendResult = { sent: boolean; reason?: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendInviteEmail(opts: { to: string; name?: string | null; link: string; role: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[sendInviteEmail] RESEND_API_KEY ausente ou vazia.");
    return { sent: false, reason: "sem provedor de e-mail (RESEND_API_KEY ausente ou vazia)" };
  }

  const from = process.env.EMAIL_FROM || "SASI LDR Hub <onboarding@resend.dev>";
  const primeiro = (opts.name || "").trim().split(/\s+/)[0];
  const ola = primeiro ? `Olá, ${escapeHtml(primeiro)}!` : "Olá!";
  const link = opts.link;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
    <div style="padding:24px 0;text-align:center">
      <span style="font-size:13px;font-weight:700;letter-spacing:2px;color:#4f46e5">SASI LDR HUB</span>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 8px;font-size:20px">${ola}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">
        Você foi convidado(a) para acessar o <strong>SASI LDR Hub</strong> com o cargo
        <strong>${escapeHtml(opts.role)}</strong>. Clique no botão abaixo para criar sua senha e concluir o cadastro.
      </p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;display:inline-block">
          Criar minha senha
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
        Este link expira em 7 dias e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#cbd5e1;margin:16px 0">SASI LTDA · acesso seguro</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: "Seu acesso ao SASI LDR Hub", html }),
    });
    if (!res.ok) {
      const t = await res.text();
      const reason = `Resend ${res.status}: ${t.slice(0, 150)}`;
      console.error("[sendInviteEmail] falhou:", reason);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (e) {
    const reason = (e as Error).message;
    console.error("[sendInviteEmail] erro de rede:", reason);
    return { sent: false, reason };
  }
}
