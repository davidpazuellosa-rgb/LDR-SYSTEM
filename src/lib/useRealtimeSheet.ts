"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { apiPath } from "@/lib/path";

export type Peer = { id: string; nome: string; inicial: string; cor: string };
export type EditItem = { id: string; key: string; value: string; custom?: boolean };
type EditPayload = { edits: EditItem[]; from: string };
export type ReorderPayload = { ids: string[]; colKey: string; dir: "asc" | "desc"; from: string };
// Criação/exclusão de linhas (inserir, excluir, desfazer/refazer, nova página, importação).
// `positions` ausente = anexa no fim (ex.: importação); presente = insere nessas posições
// (ex.: "inserir linha acima/abaixo", restaurar após excluir).
export type RowsPayload = {
  op: "insert" | "delete";
  contacts?: Record<string, unknown>[];
  ids?: string[];
  positions?: number[];
  formats?: Record<string, Record<string, unknown>>;
  from: string;
};
// Estrutura da planilha (colunas, mesclas, páginas) — sempre um SNAPSHOT do que mudou,
// nunca um diff; quem recebe só substitui o pedaço correspondente pelo valor novo.
export type LayoutPayload = {
  order?: string[];
  hidden?: string[];
  deleted?: string[];
  customCols?: { key: string; label: string }[];
  headerLabels?: Record<string, string>;
  merges?: unknown[];
  abas?: string[];
  from: string;
};
type AnyEvent = "edit" | "reorder" | "rows" | "layout";

const CORES = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444"];
function corDe(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}
function inicialDe(nome: string) {
  return (nome || "?").trim().charAt(0).toUpperCase() || "?";
}

// Sem chaves do Supabase no build => tempo real pelo próprio servidor (SSE), sem
// depender de terceiros. Com as chaves (Vercel) => segue no Supabase Realtime.
const USA_SSE = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  return client;
}

// Presença (quem está com a planilha aberta) + broadcast de TUDO que muda a planilha
// em tempo real: valores de célula, ordenação, linhas criadas/excluídas e a estrutura
// (colunas, mesclas, páginas). Degrada com elegância: sem NEXT_PUBLIC_SUPABASE_*
// (Vercel) nem SSE (nada aberto), apenas não colabora — cada um vê ao recarregar.
export function useRealtimeSheet(
  baseId: string,
  me: { id: string; nome: string },
  onRemote: (edits: EditItem[]) => void,
  onRemoteReorder?: (payload: ReorderPayload) => void,
  onRemoteRows?: (payload: RowsPayload) => void,
  onRemoteLayout?: (payload: LayoutPayload) => void,
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const sseAtivo = useRef(false);
  const baseIdRef = useRef(baseId);
  baseIdRef.current = baseId;
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const onRemoteReorderRef = useRef(onRemoteReorder);
  onRemoteReorderRef.current = onRemoteReorder;
  const onRemoteRowsRef = useRef(onRemoteRows);
  onRemoteRowsRef.current = onRemoteRows;
  const onRemoteLayoutRef = useRef(onRemoteLayout);
  onRemoteLayoutRef.current = onRemoteLayout;

  // ---- Transporte próprio (SSE) ----
  useEffect(() => {
    if (!USA_SSE || !baseId || !me.id) return;
    const es = new EventSource(apiPath(`/api/realtime/${baseId}`));
    sseAtivo.current = true;

    es.addEventListener("presence", (ev) => {
      try {
        const lista = JSON.parse((ev as MessageEvent).data) as { id: string; nome: string }[];
        setPeers(lista.map((m) => ({ id: m.id, nome: m.nome, inicial: inicialDe(m.nome), cor: corDe(m.id) })));
      } catch {
        /* mensagem inválida: ignora */
      }
    });
    es.addEventListener("edit", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as EditPayload;
        if (!p || p.from === me.id) return;
        onRemoteRef.current(p.edits || []);
      } catch {
        /* ignora */
      }
    });
    es.addEventListener("reorder", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as ReorderPayload;
        if (!p || p.from === me.id) return;
        onRemoteReorderRef.current?.(p);
      } catch {
        /* ignora */
      }
    });
    es.addEventListener("rows", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as RowsPayload;
        if (!p || p.from === me.id) return;
        onRemoteRowsRef.current?.(p);
      } catch {
        /* ignora */
      }
    });
    es.addEventListener("layout", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as LayoutPayload;
        if (!p || p.from === me.id) return;
        onRemoteLayoutRef.current?.(p);
      } catch {
        /* ignora */
      }
    });

    return () => {
      sseAtivo.current = false;
      es.close();
    };
  }, [baseId, me.id]);

  // ---- Transporte Supabase Realtime (Vercel) ----
  useEffect(() => {
    if (USA_SSE) return;
    const supa = getClient();
    if (!supa || !baseId || !me.id) return;
    const chan = supa.channel(`sheet:${baseId}`, { config: { presence: { key: me.id } } });
    chanRef.current = chan;

    chan
      .on("presence", { event: "sync" }, () => {
        const state = chan.presenceState() as Record<string, { id: string; nome: string }[]>;
        const seen = new Set<string>();
        const list: Peer[] = [];
        for (const k of Object.keys(state)) {
          const m = state[k]?.[0];
          if (!m || seen.has(m.id)) continue;
          seen.add(m.id);
          list.push({ id: m.id, nome: m.nome, inicial: inicialDe(m.nome), cor: corDe(m.id) });
        }
        setPeers(list);
      })
      .on("broadcast", { event: "edit" }, (msg) => {
        const p = msg.payload as EditPayload;
        if (!p || p.from === me.id) return;
        onRemoteRef.current(p.edits || []);
      })
      .on("broadcast", { event: "reorder" }, (msg) => {
        const p = msg.payload as ReorderPayload;
        if (!p || p.from === me.id) return;
        onRemoteReorderRef.current?.(p);
      })
      .on("broadcast", { event: "rows" }, (msg) => {
        const p = msg.payload as RowsPayload;
        if (!p || p.from === me.id) return;
        onRemoteRowsRef.current?.(p);
      })
      .on("broadcast", { event: "layout" }, (msg) => {
        const p = msg.payload as LayoutPayload;
        if (!p || p.from === me.id) return;
        onRemoteLayoutRef.current?.(p);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await chan.track({ id: me.id, nome: me.nome });
      });

    return () => {
      supa.removeChannel(chan);
      chanRef.current = null;
    };
  }, [baseId, me.id, me.nome]);

  function enviarSse(event: AnyEvent, payload: object) {
    // keepalive: o envio termina mesmo se a pessoa fechar a aba logo depois de editar
    fetch(apiPath(`/api/realtime/${baseIdRef.current}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    }).catch(() => {
      /* sem rede: a edição já foi salva no banco; o colega vê ao recarregar */
    });
  }

  function broadcast(edits: EditItem[]) {
    if (USA_SSE) {
      if (sseAtivo.current && edits.length > 0) enviarSse("edit", { edits });
      return;
    }
    const chan = chanRef.current;
    if (!chan || edits.length === 0) return;
    chan.send({ type: "broadcast", event: "edit", payload: { edits, from: me.id } as EditPayload });
  }

  function broadcastReorder(ids: string[], colKey: string, dir: "asc" | "desc") {
    if (USA_SSE) {
      if (sseAtivo.current) enviarSse("reorder", { ids, colKey, dir });
      return;
    }
    const chan = chanRef.current;
    if (!chan) return;
    chan.send({ type: "broadcast", event: "reorder", payload: { ids, colKey, dir, from: me.id } as ReorderPayload });
  }

  function broadcastRows(payload: Omit<RowsPayload, "from">) {
    if (USA_SSE) {
      if (sseAtivo.current) enviarSse("rows", payload);
      return;
    }
    const chan = chanRef.current;
    if (!chan) return;
    chan.send({ type: "broadcast", event: "rows", payload: { ...payload, from: me.id } as RowsPayload });
  }

  function broadcastLayout(payload: Omit<LayoutPayload, "from">) {
    if (USA_SSE) {
      if (sseAtivo.current) enviarSse("layout", payload);
      return;
    }
    const chan = chanRef.current;
    if (!chan) return;
    chan.send({ type: "broadcast", event: "layout", payload: { ...payload, from: me.id } as LayoutPayload });
  }

  return { peers, broadcast, broadcastReorder, broadcastRows, broadcastLayout };
}
