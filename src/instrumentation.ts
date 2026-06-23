// Sincronização AUTOMÁTICA com o HubSpot (sem botão).
// Roda quando o servidor sobe e a cada intervalo definido.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CRM_AUTO_SYNC === "false") return; // permite desligar via .env

  const { syncFromCrm } = await import("./lib/crm-sync");
  const intervalMin = Number(process.env.CRM_SYNC_INTERVAL_MIN || "360"); // padrão: 6h

  // Primeira sincronização alguns segundos após subir (não bloqueia o boot).
  setTimeout(() => {
    syncFromCrm().then((r) => console.log("[crm-sync] inicial:", JSON.stringify(r)));
  }, 8000);

  // Sincronizações periódicas.
  setInterval(() => {
    syncFromCrm().then((r) => console.log("[crm-sync] periódica:", JSON.stringify(r)));
  }, intervalMin * 60 * 1000);
}
