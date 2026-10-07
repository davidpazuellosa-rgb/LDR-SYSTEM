"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/Dropdown";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { apiPath } from "@/lib/path";

export type LinhaCredito = {
  contactId: string; pessoaId: string; pessoa: string; baseId: string; planilha: string; contato: string; em: string;
  alteracoes: { quem: string; campo: string; de: string; para: string; em: string }[];
};
export type Ajuste = { id: string; acao: string; de: string; para: string; motivo: string; por: string; em: string };
type Suspeito = { id: string; nome: string; total24h: number; picoHora: number };

const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const CARD = "rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm";

export default function CreditosView({
  linhas, truncado, periodo, periodos, pessoaSel, baseSel, pessoas, bases, suspeitos, ajustes,
}: {
  linhas: LinhaCredito[]; truncado: boolean; periodo: string; periodos: { value: string; label: string }[];
  pessoaSel: string | null; baseSel: string | null; pessoas: { id: string; nome: string }[]; bases: { id: string; nome: string }[];
  suspeitos: Suspeito[]; ajustes: Ajuste[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [reatribuir, setReatribuir] = useState<{ ids: string[] } | null>(null);
  const [paraId, setParaId] = useState("");
  const [motivoR, setMotivoR] = useState("");

  function ir(patch: Partial<{ periodo: string; pessoa: string | null; base: string | null }>) {
    const n = { periodo, pessoa: pessoaSel, base: baseSel, ...patch };
    const p = new URLSearchParams();
    if (n.periodo !== "hoje") p.set("periodo", n.periodo);
    if (n.pessoa) p.set("pessoa", n.pessoa);
    if (n.base) p.set("base", n.base);
    const qs = p.toString();
    router.push(qs ? `/creditos?${qs}` : "/creditos");
  }

  const todosIds = useMemo(() => linhas.map((l) => l.contactId), [linhas]);
  const marcarTodos = sel.size === linhas.length && linhas.length > 0;

  async function enviar(acao: "remover" | "reatribuir", ids: string[], motivo: string, para?: string) {
    setOcupado(true);
    try {
      const res = await fetch(apiPath("/api/creditos"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactIds: ids, acao, motivo, paraId: para }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error("Não foi possível alterar.", data.error); return false; }
      toast.success(acao === "remover" ? "Crédito removido." : "Crédito reatribuído.", `${data.alterados} linha(s).`);
      setSel(new Set());
      router.refresh();
      return true;
    } catch {
      toast.error("Não foi possível alterar.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function remover(ids: string[]) {
    if (ids.length === 0) return;
    const motivo = await dialog.prompt({
      title: `Remover o crédito de ${ids.length} linha(s)?`,
      message: "As linhas voltam a ficar sem pessoa registrada e deixam de contar em metas e ranking. A ação fica registrada.",
      label: "Motivo", placeholder: "ex.: só trocou maiúscula/minúscula", confirmLabel: "Remover crédito", danger: true,
    });
    if (motivo === null) return;
    await enviar("remover", ids, motivo);
  }

  async function confirmarReatribuir() {
    if (!reatribuir) return;
    const ok = await enviar("reatribuir", reatribuir.ids, motivoR, paraId);
    if (ok) { setReatribuir(null); setParaId(""); setMotivoR(""); }
  }

  const sus = suspeitos.filter((s) => !pessoaSel || s.id === pessoaSel);

  return (
    <div className="space-y-5">
      {suspeitos.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Créditos para revisar (últimas 24 h)</h2>
          <p className="mb-2 text-xs text-amber-700">Muitos créditos em pouco tempo costumam ser edição em massa de linhas que já estavam prontas.</p>
          <div className="flex flex-wrap gap-2">
            {suspeitos.map((s) => (
              <button key={s.id} type="button" onClick={() => ir({ pessoa: s.id, periodo: "48h" })} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-amber-100">
                <strong>{s.nome}</strong>
                <span className="ml-2 text-xs text-slate-500">{s.total24h} créditos · pico {s.picoHora}/hora</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Dropdown label="Período" multi={false} searchable={false} options={periodos} value={[periodo]} onChange={(v) => ir({ periodo: v[0] || "hoje" })} />
        <Dropdown label="Pessoa" options={pessoas.map((p) => ({ value: p.id, label: p.nome }))} value={pessoaSel ? [pessoaSel] : []} onChange={(v) => ir({ pessoa: v[0] || null })} />
        <Dropdown label="Planilha" options={bases.map((b) => ({ value: b.id, label: b.nome }))} value={baseSel ? [baseSel] : []} onChange={(v) => ir({ base: v[0] || null })} />
        {(pessoaSel || baseSel || periodo !== "hoje") && <button type="button" onClick={() => router.push("/creditos")} className="h-9 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-red-500">Limpar tudo</button>}
        <span className="ml-auto text-xs text-slate-400">{sus.length === 0 && pessoaSel ? "Sem alerta para esta pessoa. " : ""}{linhas.length} crédito(s){truncado ? " (mostrando os 500 mais recentes)" : ""}</span>
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm">
          <strong className="text-indigo-800">{sel.size} selecionada(s)</strong>
          <button type="button" disabled={ocupado} onClick={() => remover([...sel])} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">Remover crédito</button>
          <button type="button" disabled={ocupado} onClick={() => setReatribuir({ ids: [...sel] })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Passar para outra pessoa…</button>
          <button type="button" onClick={() => setSel(new Set())} className="text-slate-500 hover:text-slate-800">Limpar seleção</button>
        </div>
      )}

      <section className={`${CARD} overflow-x-auto !p-0`}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Selecionar todas" checked={marcarTodos} onChange={() => setSel(marcarTodos ? new Set() : new Set(todosIds))} className="h-4 w-4 accent-indigo-600" /></th>
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Crédito de</th>
              <th className="px-3 py-2 font-medium">Planilha</th>
              <th className="px-3 py-2 font-medium">Contato</th>
              <th className="px-3 py-2 font-medium">Últimas alterações da linha</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {linhas.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhum crédito neste filtro.</td></tr>}
            {linhas.map((l) => (
              <tr key={l.contactId} className="align-top hover:bg-slate-50/60">
                <td className="px-3 py-2"><input type="checkbox" aria-label="Selecionar" checked={sel.has(l.contactId)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(l.contactId)) n.delete(l.contactId); else n.add(l.contactId); return n; })} className="h-4 w-4 accent-indigo-600" /></td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{hora(l.em)}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{l.pessoa}</td>
                <td className="px-3 py-2 text-slate-600">{l.planilha}</td>
                <td className="px-3 py-2 text-slate-600">{l.contato}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {l.alteracoes.length === 0 ? <span className="text-slate-400">sem registro (anterior ao histórico)</span> : l.alteracoes.map((a, i) => (
                    <div key={i}><strong className="text-slate-600">{a.quem}</strong> · {a.campo}: “{a.de || "vazio"}” → “{a.para || "vazio"}” <span className="text-slate-400">({hora(a.em)})</span></div>
                  ))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" disabled={ocupado} onClick={() => remover([l.contactId])} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">Remover</button>
                  <button type="button" disabled={ocupado} onClick={() => setReatribuir({ ids: [l.contactId] })} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-60">Passar…</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={CARD}>
        <h2 className="mb-2 text-[13px] font-semibold text-slate-700">Ajustes recentes</h2>
        {ajustes.length === 0 ? <p className="text-xs text-slate-400">Nenhum ajuste feito ainda.</p> : (
          <ul className="divide-y divide-slate-50 text-xs text-slate-600">
            {ajustes.map((a) => (
              <li key={a.id} className="py-1.5">
                <span className="tabular-nums text-slate-400">{hora(a.em)}</span> · <strong>{a.por}</strong>{" "}
                {a.acao === "removido" ? `removeu o crédito de ${a.de}` : `passou o crédito de ${a.de} para ${a.para}`} — “{a.motivo}”
              </li>
            ))}
          </ul>
        )}
      </section>

      {reatribuir && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && setReatribuir(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Passar o crédito de {reatribuir.ids.length} linha(s)</h2>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Para quem</label>
            <select value={paraId} onChange={(e) => setParaId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Escolha…</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Motivo</label>
            <input value={motivoR} onChange={(e) => setMotivoR(e.target.value)} placeholder="ex.: quem de fato preencheu" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setReatribuir(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={ocupado || !paraId || motivoR.trim().length < 3} onClick={confirmarReatribuir} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Passar crédito</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
