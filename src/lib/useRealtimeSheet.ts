"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export type Peer = { id: string; nome: string; inicial: string; cor: string };
export type EditItem = { id: string; key: string; value: string; custom?: boolean };
type EditPayload = { edits: EditItem[]; from: string };
export type ReorderPayload = { ids: string[]; colKey: string; dir: "asc" | "desc"; from: string };

const CORES = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444"];
function corDe(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}
function inicialDe(nome: string) {
  return (nome || "?").trim().charAt(0).toUpperCase() || "?";
}

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  return client;
}

// Presença (quem está com a planilha aberta) + broadcast das edições em tempo real.
// Degrada com elegância: sem as chaves NEXT_PUBLIC_SUPABASE_*, apenas não colabora.
export function useRealtimeSheet(
  baseId: string,
  me: { id: string; nome: string },
  onRemote: (edits: EditItem[]) => void,
  onRemoteReorder?: (payload: ReorderPayload) => void,
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const onRemoteReorderRef = useRef(onRemoteReorder);
  onRemoteReorderRef.current = onRemoteReorder;

  useEffect(() => {
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
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await chan.track({ id: me.id, nome: me.nome });
      });

    return () => {
      supa.removeChannel(chan);
      chanRef.current = null;
    };
  }, [baseId, me.id, me.nome]);

  function broadcast(edits: EditItem[]) {
    const chan = chanRef.current;
    if (!chan || edits.length === 0) return;
    chan.send({ type: "broadcast", event: "edit", payload: { edits, from: me.id } as EditPayload });
  }

  function broadcastReorder(ids: string[], colKey: string, dir: "asc" | "desc") {
    const chan = chanRef.current;
    if (!chan) return;
    chan.send({ type: "broadcast", event: "reorder", payload: { ids, colKey, dir, from: me.id } as ReorderPayload });
  }

  return { peers, broadcast, broadcastReorder };
}
