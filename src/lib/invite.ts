// Convite seguro SEM mudar o banco: o "token" do convite fica guardado como uma
// SENTINELA no campo passwordHash do usuário, no formato:  invite$<sha256(segredo)>$<validade>
// - O link recebido pela pessoa contém o segredo bruto (que NÃO é guardado).
// - No banco fica só o hash do segredo + a validade -> um vazamento do banco não
//   expõe links utilizáveis.
// - Enquanto a senha não for definida, o passwordHash não é um hash bcrypt válido,
//   então a pessoa NÃO consegue logar (e o admin nunca vê/define a senha).
import crypto from "node:crypto";

const PREFIX = "invite$";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function makeInvite(userId: string): { token: string; sentinel: string } {
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = Buffer.from(`${userId}:${secret}`).toString("base64url");
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  const expiresAt = Date.now() + TTL_MS;
  return { token, sentinel: `${PREFIX}${hash}$${expiresAt}` };
}

export function parseToken(token: string): { userId: string; secret: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const i = decoded.indexOf(":");
    if (i <= 0) return null;
    return { userId: decoded.slice(0, i), secret: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export function isInvitePending(passwordHash: string | null | undefined): boolean {
  return !!passwordHash && passwordHash.startsWith(PREFIX);
}

export function verifyInvite(passwordHash: string, secret: string): { ok: boolean; reason?: string } {
  if (!isInvitePending(passwordHash)) return { ok: false, reason: "Este convite já foi usado ou não é válido." };
  const [hash, expStr] = passwordHash.slice(PREFIX.length).split("$");
  const exp = Number(expStr);
  if (!hash || !exp) return { ok: false, reason: "Convite inválido." };
  if (Date.now() > exp) return { ok: false, reason: "Convite expirado. Peça um novo link ao administrador." };
  const got = crypto.createHash("sha256").update(secret).digest("hex");
  const a = Buffer.from(got);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "Convite inválido." };
  return { ok: true };
}

// Monta o link público do convite a partir do host da requisição (respeita basePath).
export function buildInviteLink(req: Request, token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/^\/+|\/+$/g, "");
  const basePath = base ? `/${base}` : "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}${basePath}/definir-senha/${token}`;
}
