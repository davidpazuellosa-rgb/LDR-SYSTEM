"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { ufSigla } from "@/lib/uf";
import { CONTACT_FIELDS } from "@/lib/contact-fields";
import { STATUS_META, STATUS_OK, STATUS_INCORRETO, STATUS_ATUALIZADO } from "@/lib/status";
import { useToast } from "@/components/Toast";
import { useTitle } from "@/components/TitleContext";
import HistoricoModal from "@/components/HistoricoModal";

type Contact = {
  id: string;
  status: string;
  [key: string]: string | null | undefined;
};

type CellRef = {
  row: number;
  col: number;
};

type CellFmt = {
  b?: boolean;
  i?: boolean;
  s?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
};

// Uma alteração de valor de célula; o histórico guarda LOTES (um lote por ação),
// para que desfazer/refazer revertam edição única, colar, limpar, recortar e mesclar.
type CellEdit = { id: string; key: string; prev: string; next: string };
type FormatEdit = { id: string; key: string; prev: CellFmt; next: CellFmt };
type HistoryAction =
  | { kind: "cells"; edits: CellEdit[] }
  | { kind: "formats"; edits: FormatEdit[] }
  // Exclusão de linhas (soft delete): guarda os contatos e seus formatos para
  // poder restaurar (desfazer) ou excluir de novo (refazer).
  | { kind: "delete"; contacts: Contact[]; formats: Record<string, Record<string, CellFmt>> };

// "Marca-d'água" de copiar/recortar (estilo Google Sheets): as células ficam
// tracejadas. No recorte, a origem só é apagada DEPOIS de colar (mover).
type Clip = {
  mode: "copy" | "cut";
  rect: { startRow: number; endRow: number; startCol: number; endCol: number };
  cells: { id: string; key: string }[];
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_META[status] || STATUS_META[STATUS_OK];
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${s.badge}`}>{s.label}</span>
  );
}

// Dica visual ao passar o mouse (renderizada via portal para não ser cortada
// pelo overflow da barra de ferramentas). Mostra rápido, ~120ms.
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 6;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos({ x, y }), 120);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <span className="inline-flex shrink-0" onMouseEnter={show} onMouseLeave={hide} onMouseDown={hide}>
      {children}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: pos.x, top: pos.y }}
            className="pointer-events-none fixed z-[200] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}

function ToolBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        disabled={disabled}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ToolDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}

// Item do menu de contexto (botão direito).
function MenuRow({
  icon,
  label,
  shortcut,
  arrow,
  disabled,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  arrow?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center text-slate-500">{icon}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {shortcut && <span className="text-xs text-slate-400">{shortcut}</span>}
      {arrow && (
        <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// Converte um índice de coluna (0-based) na letra estilo planilha: 0 -> A, 25 -> Z, 26 -> AA.
function colLetter(index: number): string {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export default function ContactsTable({
  baseId,
  initialContacts,
  initialFormats = {},
  initialHeaders = {},
  initialSavedAt = null,
  canDelete = true,
  canImport = true,
  canExport = true,
  canEditHeaders = false,
}: {
  baseId: string;
  initialContacts: Contact[];
  initialFormats?: Record<string, Record<string, CellFmt>>;
  initialHeaders?: Record<string, string>;
  initialSavedAt?: string | null;
  canDelete?: boolean;
  canImport?: boolean;
  canExport?: boolean;
  canEditHeaders?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // Estado de salvamento mostrado ao lado do título (substitui os toasts da planilha).
  const { setSaved } = useTitle();
  const markSaving = useCallback(() => setSaved({ state: "saving", at: Date.now() }), [setSaved]);
  const markSaved = useCallback(() => setSaved({ state: "saved", at: Date.now() }), [setSaved]);
  const markSaveError = useCallback(() => setSaved({ state: "error", at: Date.now() }), [setSaved]);
  // Mostra a última data salva ao abrir (persistida no updatedAt dos contatos);
  // limpa o indicador ao sair da planilha (outras telas não mostram nada).
  useEffect(() => {
    if (initialSavedAt) setSaved({ state: "saved", at: new Date(initialSavedAt).getTime() });
    return () => setSaved(null);
  }, [initialSavedAt, setSaved]);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [headerLabels, setHeaderLabels] = useState<Record<string, string>>(initialHeaders);
  const [importing, setImporting] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ eventoId: string; resumo: string } | null>(null);
  const [anchorCell, setAnchorCell] = useState<CellRef | null>(null);
  const [focusCell, setFocusCell] = useState<CellRef | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);
  const [density, setDensity] = useState<"compacta" | "normal" | "ampla">("normal");
  const [frozen, setFrozen] = useState(false);
  const [formats, setFormats] = useState<Record<string, Record<string, CellFmt>>>(initialFormats);
  // Célula em edição (null = apenas seleção, sem editar) e o caractere inicial ao digitar direto.
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [editSeed, setEditSeed] = useState<string | null>(null);
  // Menu de contexto (botão direito) e o submenu "Colar especial".
const [menu, setMenu] = useState<
  | { type: "cell"; x: number; y: number }
  | { type: "column"; x: number; y: number; col: number }
  | { type: "row"; x: number; y: number; row: number }
  | null
>(null);
const [pasteSpecialOpen, setPasteSpecialOpen] = useState(false);
const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(() => new Set());
// Colunas ocultas/"excluídas" da visão (campos fixos não são apagados do banco).
const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => new Set());
  // Células copiadas/recortadas e marcadas (tracejado tipo Google Sheets).
  const [clip, setClip] = useState<Clip | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Largura das colunas — ajustável (arrastar a borda / duplo-clique p/ ajustar)
  // e guardada por base no navegador (localStorage), sem mexer no banco.
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`colw:${baseId}`);
      if (saved) setColWidths(JSON.parse(saved));
    } catch {
      // localStorage indisponível ou JSON inválido — ignora
    }
  }, [baseId]);
  const colW = (col: { key: string; width?: number }) => colWidths[col.key] ?? col.width ?? 150;
  function startColResize(e: React.MouseEvent, col: { key: string; width?: number }) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW(col);
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(60, Math.min(700, startW + (ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [col.key]: w }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setColWidths((prev) => {
        try {
          localStorage.setItem(`colw:${baseId}`, JSON.stringify(prev));
        } catch {
          // ignora
        }
        return prev;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function autoFitColumn(col: { key: string; width?: number; label: string }) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
    let max = ctx.measureText(headerLabelFor(col.key, col.label)).width;
    for (const c of visible) {
      const v = (c as unknown as Record<string, string | null>)[col.key] || "";
      const w = ctx.measureText(v).width;
      if (w > max) max = w;
    }
    // Largura do conteúdo + 15% de folga à direita + padding, com limites.
    const width = Math.min(560, Math.max(80, Math.round(max * 1.15) + 28));
    setColWidths((prev) => {
      const next = { ...prev, [col.key]: width };
      try {
        localStorage.setItem(`colw:${baseId}`, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  }

  const fmtOf = (id: string, key: string): CellFmt => formats[id]?.[key] || {};
  const padY = density === "compacta" ? "py-0.5" : density === "ampla" ? "py-2.5" : "py-1";

  const ALL = "__all__";
  const NO_UF = "__no_uf__";
  // Colunas exibidas (todas menos as ocultas). Todo o índice de coluna (seleção,
  // copiar/colar, letras) usa esta lista, então ocultar uma coluna "funciona" inteiro.
  const visibleFields = useMemo(
    () => CONTACT_FIELDS.filter((f) => !hiddenColumns.has(f.key)),
    [hiddenColumns]
  );
  const headerLabelFor = useCallback(
    (key: string, fallback: string) => headerLabels[key] || fallback,
    [headerLabels]
  );
  const fieldKeys = useMemo(() => visibleFields.map((field) => field.key), [visibleFields]);

  const ufOf = (c: Contact) => ((c.estado as string) || "").trim().toUpperCase() || NO_UF;

  // Filtro por situação do telefone (nomenclatura do CRM).
  const [phoneFilter, setPhoneFilter] = useState<string>("all");
  const matchesPhone = useCallback(
    (c: Contact) => (phoneFilter === "all" ? true : c.status === phoneFilter),
    [phoneFilter],
  );

  // Abre já na primeira UF presente (carrega rápido mesmo com muitas linhas).
  const firstUf = useMemo(() => {
    const ufs = Array.from(
      new Set(
        initialContacts.map((c) => ((c.estado as string) || "").trim().toUpperCase()).filter(Boolean)
      )
    ).sort();
    return ufs[0] || ALL;
  }, [initialContacts]);
  const [tab, setTab] = useState(firstUf);

  // Lista estável de UFs (as abas não somem); a contagem reflete o filtro de telefone ativo.
  const allUfs = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) set.add(ufOf(c));
    return Array.from(set).sort((a, b) => {
      if (a === NO_UF) return 1;
      if (b === NO_UF) return -1;
      return a.localeCompare(b);
    });
  }, [contacts]);

  const estados = useMemo(() => {
    const counts = new Map<string, number>();
    for (const uf of allUfs) counts.set(uf, 0);
    for (const c of contacts) {
      if (!matchesPhone(c)) continue;
      counts.set(ufOf(c), (counts.get(ufOf(c)) || 0) + 1);
    }
    return allUfs.map((uf) => [uf, counts.get(uf) || 0] as [string, number]);
  }, [contacts, allUfs, matchesPhone]);

  // Total da aba "Todas" também acompanha o filtro.
  const filteredTotal = useMemo(
    () => contacts.filter(matchesPhone).length,
    [contacts, matchesPhone]
  );

  // Contagem GLOBAL por status (soma de todos os estados da base).
  const counts = useMemo(() => {
    const by = (s: string) => contacts.filter((c) => c.status === s).length;
    return {
      all: contacts.length,
      [STATUS_INCORRETO]: by(STATUS_INCORRETO),
      [STATUS_ATUALIZADO]: by(STATUS_ATUALIZADO),
      [STATUS_OK]: by(STATUS_OK),
    } as Record<string, number>;
  }, [contacts]);

  // Chave de associação: muda só quando contatos são adicionados/removidos.
  const membershipKey = useMemo(() => contacts.map((c) => c.id).join("|"), [contacts]);

  // IDs das linhas visíveis (aba/filtro/busca) — "congelados" enquanto se edita:
  // editar ou limpar uma célula NÃO remove a linha da visão atual (igual ao Excel).
  // Só recalcula ao trocar de aba/filtro/busca ou adicionar/remover linhas.
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => tab === ALL || ufOf(c) === tab)
      .filter(matchesPhone)
      .filter((c) => !hiddenRowIds.has(c.id))
      .filter((c) => !q || CONTACT_FIELDS.some((f) => String(c[f.key] || "").toLowerCase().includes(q)))
      .map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, phoneFilter, search, membershipKey, hiddenRowIds]);

  // Mapa id -> contato ATUAL (para a tela refletir as edições na hora).
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const visible = useMemo(
    () => visibleIds.map((id) => contactById.get(id)).filter((c): c is Contact => Boolean(c)),
    [visibleIds, contactById]
  );

  // Limpa a seleção quando o conjunto visível muda (troca de aba/filtro/busca):
  // os índices anchor/focus apontam para posições em `visible` e, sem isso,
  // passariam a referenciar contatos diferentes dos exibidos.
  useEffect(() => {
    setAnchorCell(null);
    setFocusCell(null);
    setEditingCell(null);
    setClip(null);
  }, [tab, phoneFilter, search]);

  async function saveHeaderLabel(key: string, fallback: string, nextRaw: string) {
    const next = nextRaw.trim() || fallback;
    const prev = headerLabelFor(key, fallback);
    if (next === prev) return;

    setHeaderLabels((labels) => ({ ...labels, [key]: next }));
    markSaving();

    try {
      const res = await fetch(apiPath(`/api/bases/${baseId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: { [key]: next } }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      markSaved();
    } catch (err) {
      setHeaderLabels((labels) => ({ ...labels, [key]: prev }));
      markSaveError();
      toast.error("Não foi possível salvar o cabeçalho.", (err as Error).message);
    }
  }

  // Encerra o arraste de seleção mesmo quando o botão é solto fora da grade.
  useEffect(() => {
    const onUp = () => setIsDragging(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  // Fecha o menu de contexto ao apertar Esc ou rolar a página/grade.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onScroll = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  // Aplica um lote de alterações (na direção "prev" ou "next"): atualiza a tela
  // e persiste no servidor agrupando por contato. Usado por desfazer/refazer.
  async function applyBatch(edits: CellEdit[], useNext: boolean) {
  if (edits.length === 0) return;

  setContacts((prev) =>
    prev.map((contact) => {
      const mine = edits.filter((edit) => edit.id === contact.id);
      if (mine.length === 0) return contact;
      return mine.reduce<Contact>(
        (acc, edit) => ({ ...acc, [edit.key]: useNext ? edit.next : edit.prev }),
        contact
      );
    })
  );

  const byId = new Map<string, Record<string, string>>();
  for (const edit of edits) {
    const data = byId.get(edit.id) || {};
    data[edit.key] = useNext ? edit.next : edit.prev;
    byId.set(edit.id, data);
  }

  markSaving();
  try {
    const results = await Promise.all(
      Array.from(byId).map(([id, data]) =>
        fetch(apiPath(`/api/contacts/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      )
    );
    if (results.every((r) => r.ok)) markSaved();
    else markSaveError();
  } catch {
    markSaveError();
  }
}

  // Registra um lote no histórico (descartando o "refazer" pendente).
  function recordBatch(edits: CellEdit[]) {
  const real = edits.filter((edit) => edit.prev !== edit.next);
  if (real.length === 0) return;
  setHistory((items) => [...items, { kind: "cells" as const, edits: real }].slice(-100));
  setRedoStack([]);
}

  function recordEdit(edit: CellEdit) {
    recordBatch([edit]);
  }

  // Registra uma exclusão de linhas no histórico (para desfazer/refazer).
  function recordDelete(deleted: Contact[], deletedFormats: Record<string, Record<string, CellFmt>>) {
    if (deleted.length === 0) return;
    setHistory((items) => [...items, { kind: "delete" as const, contacts: deleted, formats: deletedFormats }].slice(-100));
    setRedoStack([]);
  }

  // Aplica/desfaz uma exclusão: redelete=true exclui de novo; false restaura.
  async function applyDeleteBatch(
    action: { contacts: Contact[]; formats: Record<string, Record<string, CellFmt>> },
    redelete: boolean
  ) {
    const ids = action.contacts.map((c) => c.id);
    markSaving();
    if (redelete) {
      setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
      setAnchorCell(null);
      setFocusCell(null);
    } else {
      setContacts((prev) => [...prev, ...action.contacts]);
      if (Object.keys(action.formats).length) setFormats((prev) => ({ ...prev, ...action.formats }));
    }
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(apiPath(redelete ? `/api/contacts/${id}` : `/api/contacts/${id}/restore`), {
            method: redelete ? "DELETE" : "POST",
          })
        )
      );
      if (results.every((r) => r.ok)) markSaved();
      else markSaveError();
    } catch {
      markSaveError();
    }
  }

  async function undo() {
  if (history.length === 0) return;
  const action = history[history.length - 1];
  setHistory((items) => items.slice(0, -1));
  setRedoStack((items) => [...items, action]);

  if (action.kind === "cells") applyBatch(action.edits, false);
  else if (action.kind === "formats") applyFormatBatch(action.edits, false);
  else applyDeleteBatch(action, false); // restaura as linhas excluídas

  setClip(null);
}

  async function redo() {
  if (redoStack.length === 0) return;
  const action = redoStack[redoStack.length - 1];
  setRedoStack((items) => items.slice(0, -1));
  setHistory((items) => [...items, action]);

  if (action.kind === "cells") applyBatch(action.edits, true);
  else if (action.kind === "formats") applyFormatBatch(action.edits, true);
  else applyDeleteBatch(action, true); // exclui de novo

  setClip(null);
}

  // Recorta: copia para a área de transferência e MARCA as células (tracejado).
  // NÃO apaga agora — a origem só é limpa quando o usuário colar (mover).
  async function cutSelectedCells() {
    if (selectedCells.length === 0 || !selBounds) return;
    const tsv = buildSelectionTSV();
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      /* segue mesmo sem clipboard do SO */
    }
    setClip({
      mode: "cut",
      rect: { ...selBounds },
      cells: selectedCells.map((c) => ({ id: c.contact.id, key: c.key })),
    });
  }

  // Depois de colar: se havia um RECORTE marcado, apaga a origem (que não foi
  // sobrescrita pelo destino) e remove a marca. Cópia mantém a marca até Esc.
  async function afterPaste(written: Array<{ id: string; key: string; value: string }>) {
    if (clip?.mode === "cut") {
      const dest = new Set(written.map((u) => `${u.id}::${u.key}`));
      const toClear = clip.cells.filter((c) => !dest.has(`${c.id}::${c.key}`));
      if (toClear.length) {
        await persistCells(toClear.map((c) => ({ id: c.id, key: c.key, value: "" })));
      }
      setClip(null);
    }
  }

  async function pasteFromClipboard() {
    if (!anchorCell || !focusCell) return;
    // Cola a partir do canto superior-esquerdo da seleção (igual ao Ctrl+V).
    const startRow = Math.min(anchorCell.row, focusCell.row);
    const startCol = Math.min(anchorCell.col, focusCell.col);
    try {
      const text = await navigator.clipboard.readText();
      if (text) await afterPaste(await pasteGrid(startRow, startCol, text, false, selBounds));
    } catch {
      toast.error("Não foi possível ler a área de transferência.", "Use Ctrl+V na célula.");
    }
  }

  // "Colar especial": valores apenas (igual ao colar normal, sem formatação) ou transposto.
  async function pasteSpecial(transpose: boolean) {
    if (!anchorCell || !focusCell) return;
    const startRow = Math.min(anchorCell.row, focusCell.row);
    const startCol = Math.min(anchorCell.col, focusCell.col);
    try {
      const text = await navigator.clipboard.readText();
      if (text) await afterPaste(await pasteGrid(startRow, startCol, text, transpose, selBounds));
    } catch {
      toast.error("Não foi possível ler a área de transferência.", "Use Ctrl+V na célula.");
    }
  }

  // Abre o menu de contexto (botão direito) na posição do cursor.
  function openContextMenu(e: React.MouseEvent, rowIndex: number, colIndex: number) {
    e.preventDefault();
    commitActiveEdit();
    if (!isSelected(rowIndex, colIndex)) {
      setEditingCell(null);
      setAnchorCell({ row: rowIndex, col: colIndex });
      setFocusCell({ row: rowIndex, col: colIndex });
    }
    setPasteSpecialOpen(false);
  setMenu({ type: "cell", x: e.clientX, y: e.clientY });
}

function openColumnContextMenu(e: React.MouseEvent, colIndex: number) {
  e.preventDefault();
  e.stopPropagation();
  selectColumn(colIndex, e.shiftKey);
  if (!canEditHeaders) return; // LDR só preenche: não altera a estrutura das colunas
  setPasteSpecialOpen(false);
  setMenu({ type: "column", x: e.clientX, y: e.clientY, col: colIndex });
}

function openRowContextMenu(e: React.MouseEvent, rowIndex: number) {
  e.preventDefault();
  e.stopPropagation();
  selectRow(rowIndex, e.shiftKey);
  setPasteSpecialOpen(false);
  setMenu({ type: "row", x: e.clientX, y: e.clientY, row: rowIndex });
}

  // ---- Formatação por célula (estilo planilha) ----
  
function selectionAllHave(pred: (fmt: CellFmt) => boolean) {
  return selectedCells.length > 0 && selectedCells.every((cell) => pred(fmtOf(cell.contact.id, cell.key)));
}

function isSameFormat(a: CellFmt, b: CellFmt) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function recordFormatBatch(edits: FormatEdit[]) {
  const real = edits.filter((edit) => !isSameFormat(edit.prev, edit.next));
  if (real.length === 0) return;
  setHistory((items) => [...items, { kind: "formats" as const, edits: real }].slice(-100));
  setRedoStack([]);
}

  async function persistFormatRows(nextFormats: Record<string, Record<string, CellFmt>>, ids: string[]) {
    markSaving();
    try {
      const results = await Promise.all(
        Array.from(new Set(ids)).map((id) =>
          fetch(apiPath(`/api/contacts/${id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formats: nextFormats[id] || null }),
          })
        )
      );
      if (results.every((r) => r.ok)) markSaved();
      else markSaveError();
    } catch {
      markSaveError();
    }
  }

function applyFormatBatch(edits: FormatEdit[], useNext: boolean) {
  if (edits.length === 0) return;
  let snapshot: Record<string, Record<string, CellFmt>> = {};
  const touched = new Set<string>();

  setFormats((prev) => {
    const next: Record<string, Record<string, CellFmt>> = { ...prev };
    for (const edit of edits) {
      const row = { ...(next[edit.id] || {}) };
      row[edit.key] = { ...(useNext ? edit.next : edit.prev) };
      next[edit.id] = row;
      touched.add(edit.id);
    }
    snapshot = next;
    return next;
  });

  queueMicrotask(() => persistFormatRows(snapshot, Array.from(touched)));
}

function applyFormat(producer: (current: CellFmt) => CellFmt) {
  if (selectedCells.length === 0) return;

  const edits: FormatEdit[] = [];
  const touched = new Set<string>();
  let snapshot: Record<string, Record<string, CellFmt>> = {};

  setFormats((prev) => {
    const next: Record<string, Record<string, CellFmt>> = { ...prev };
    for (const cell of selectedCells) {
      const prevFmt = { ...fmtOf(cell.contact.id, cell.key) };
      const nextFmt = { ...producer(prevFmt) };
      edits.push({ id: cell.contact.id, key: cell.key, prev: prevFmt, next: nextFmt });
      next[cell.contact.id] = { ...(next[cell.contact.id] || {}), [cell.key]: nextFmt };
      touched.add(cell.contact.id);
    }
    snapshot = next;
    return next;
  });

  recordFormatBatch(edits);
  queueMicrotask(() => persistFormatRows(snapshot, Array.from(touched)));
  focusGrid();
}

function toggleBold() {
  const on = !selectionAllHave((fmt) => !!fmt.b);
  applyFormat((fmt) => ({ ...fmt, b: on }));
}

function toggleItalic() {
  const on = !selectionAllHave((fmt) => !!fmt.i);
  applyFormat((fmt) => ({ ...fmt, i: on }));
}

function toggleStrike() {
  const on = !selectionAllHave((fmt) => !!fmt.s);
  applyFormat((fmt) => ({ ...fmt, s: on }));
}

function setTextColor(color: string) {
  applyFormat((fmt) => ({ ...fmt, color }));
}

function setFillColor(bg: string) {
  applyFormat((fmt) => ({ ...fmt, bg }));
}

function setAlign(align: CellFmt["align"]) {
  applyFormat((fmt) => ({ ...fmt, align }));
}


  const selectedCells = useMemo(() => {
    if (!anchorCell || !focusCell) return [];

    const startRow = Math.min(anchorCell.row, focusCell.row);
    const endRow = Math.max(anchorCell.row, focusCell.row);
    const startCol = Math.min(anchorCell.col, focusCell.col);
    const endCol = Math.max(anchorCell.col, focusCell.col);
    const cells: Array<CellRef & { contact: Contact; key: string }> = [];

    for (let row = startRow; row <= endRow; row++) {
      const contact = visible[row];
      if (!contact) continue;
      for (let col = startCol; col <= endCol; col++) {
        const key = fieldKeys[col];
        if (key) cells.push({ row, col, contact, key });
      }
    }

    return cells;
  }, [anchorCell, fieldKeys, focusCell, visible]);

  const selectedCount = selectedCells.length;

  // Limites do retângulo selecionado — usado para destacar células, números de linha e letras de coluna.
  const selBounds = useMemo(() => {
    if (!anchorCell || !focusCell) return null;
    return {
      startRow: Math.min(anchorCell.row, focusCell.row),
      endRow: Math.max(anchorCell.row, focusCell.row),
      startCol: Math.min(anchorCell.col, focusCell.col),
      endCol: Math.max(anchorCell.col, focusCell.col),
    };
  }, [anchorCell, focusCell]);

  function isSelected(row: number, col: number) {
    if (!selBounds) return false;
    return (
      row >= selBounds.startRow &&
      row <= selBounds.endRow &&
      col >= selBounds.startCol &&
      col <= selBounds.endCol
    );
  }

  // Devolve o foco do teclado para a grade (para navegar com as setas após editar/colar).
  function focusGrid() {
    requestAnimationFrame(() => gridRef.current?.focus());
  }

  function selectCell(row: number, col: number, extend = false) {
    const next = { row, col };
    if (extend && anchorCell) {
      setFocusCell(next);
    } else {
      setAnchorCell(next);
      setFocusCell(next);
    }
  }

  function selectAndFocus(row: number, col: number) {
    selectCell(row, col);
    focusGrid();
  }

  // Entra no modo de edição da célula. `seed` = caractere digitado que inicia a edição.
  function startEditing(row: number, col: number, seed: string | null = null) {
    setClip(null); // editar cancela a marca de copiar/recortar
    setAnchorCell({ row, col });
    setFocusCell({ row, col });
    setEditSeed(seed);
    setEditingCell({ row, col });
  }

  function stopEditing(refocus = true) {
    setEditingCell(null);
    setEditSeed(null);
    if (refocus) focusGrid();
  }

  // Salva uma edição em andamento antes de mudar a seleção por outro caminho
  // (clicar nº da linha, letra da coluna, "selecionar tudo"). Sem isso, o
  // preventDefault do mousedown impediria o blur/salvamento da célula.
  function commitActiveEdit() {
    if (editingCell && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  // Seleciona uma linha inteira (clicando no número da linha).
  function selectRow(row: number, extend = false) {
    if (visible.length === 0 || fieldKeys.length === 0) return;
    commitActiveEdit();
    setEditingCell(null);
    if (extend && anchorCell) {
      setAnchorCell({ row: anchorCell.row, col: 0 });
      setFocusCell({ row, col: fieldKeys.length - 1 });
    } else {
      setAnchorCell({ row, col: 0 });
      setFocusCell({ row, col: fieldKeys.length - 1 });
    }
    focusGrid();
  }

  // Seleciona uma coluna inteira (clicando na letra da coluna).
  function selectColumn(col: number, extend = false) {
    if (visible.length === 0) return;
    commitActiveEdit();
    setEditingCell(null);
    if (extend && anchorCell) {
      setAnchorCell({ row: 0, col: anchorCell.col });
      setFocusCell({ row: visible.length - 1, col });
    } else {
      setAnchorCell({ row: 0, col });
      setFocusCell({ row: visible.length - 1, col });
    }
    focusGrid();
  }

  // Seleciona tudo (clicando no canto superior esquerdo).
  function selectAll() {
    if (visible.length === 0 || fieldKeys.length === 0) return;
    commitActiveEdit();
    setEditingCell(null);
    setAnchorCell({ row: 0, col: 0 });
    setFocusCell({ row: visible.length - 1, col: fieldKeys.length - 1 });
    focusGrid();
  }

async function clearColumn(colIndex: number) {
  const key = fieldKeys[colIndex];
  if (!key) return;

  const edits = visible
    .map((contact) => ({
      id: contact.id,
      key,
      prev: String(contact[key] ?? ""),
      next: "",
    }))
    .filter((edit) => edit.prev !== "");

  if (edits.length === 0) {
    setMenu(null);
    return;
  }

  setHistory((prev) => [...prev, { kind: "cells", edits }]);
  setRedoStack([]);
  await applyBatch(edits, true);
  setMenu(null);
}

// Oculta uma coluna da visão (os dados continuam no banco — campos fixos).
function hideColumn(colIndex: number) {
  const key = fieldKeys[colIndex];
  if (!key) return;
  setHiddenColumns((prev) => new Set(prev).add(key));
  setAnchorCell(null);
  setFocusCell(null);
  setClip(null);
  setMenu(null);
}

function showAllColumns() {
  setHiddenColumns(new Set());
  setAnchorCell(null);
  setFocusCell(null);
}

async function insertRowNear(rowIndex: number, side: "above" | "below") {
  setClip(null);
  const estado = tab !== ALL && tab !== NO_UF ? tab : undefined;
  const res = await fetch(apiPath("/api/contacts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseId, estado }),
  });

  if (!res.ok) {
    toast.error("Não foi possível inserir a linha.");
    setMenu(null);
    return;
  }

  const created = await res.json();
  const reference = visible[rowIndex];
  setContacts((prev) => {
    const referenceIndex = reference ? prev.findIndex((contact) => contact.id === reference.id) : -1;
    const insertAt = referenceIndex < 0 ? prev.length : referenceIndex + (side === "below" ? 1 : 0);
    return [...prev.slice(0, insertAt), created, ...prev.slice(insertAt)];
  });
  setHiddenRowIds((prev) => {
    const next = new Set(prev);
    next.delete(created.id);
    return next;
  });
  setMenu(null);
  selectAndFocus(rowIndex + (side === "below" ? 1 : 0), 0);
  markSaved();
}

async function deleteRow(rowIndex: number) {
  const contact = visible[rowIndex];
  if (!contact) return;
  if (!confirm("Excluir esta linha?")) return;

  markSaving();
  const res = await fetch(apiPath(`/api/contacts/${contact.id}`), { method: "DELETE" });
  if (!res.ok) {
    markSaveError();
    toast.error("Não foi possível excluir a linha.", "Verifique suas permissões.");
    setMenu(null);
    return;
  }

  // Guarda contato e formato para permitir desfazer a exclusão.
  const deletedFormats: Record<string, Record<string, CellFmt>> = {};
  if (formats[contact.id]) deletedFormats[contact.id] = formats[contact.id];
  recordDelete([contact], deletedFormats);

  setContacts((prev) => prev.filter((c) => c.id !== contact.id));
  setHiddenRowIds((prev) => {
    const next = new Set(prev);
    next.delete(contact.id);
    return next;
  });
  setAnchorCell(null);
  setFocusCell(null);
  setClip(null);
  setMenu(null);
  markSaved();
}

async function clearRow(rowIndex: number) {
  const contact = visible[rowIndex];
  if (!contact) return;

  const edits = fieldKeys
    .map((key) => ({
      id: contact.id,
      key,
      prev: String(contact[key] ?? ""),
      next: "",
    }))
    .filter((edit) => edit.prev !== "");

  if (edits.length === 0) {
    setMenu(null);
    return;
  }

  setHistory((prev) => [...prev, { kind: "cells", edits }]);
  setRedoStack([]);
  await applyBatch(edits, true);
  setMenu(null);
}

function hideRow(rowIndex: number) {
  const contact = visible[rowIndex];
  if (!contact) return;

  setHiddenRowIds((prev) => {
    const next = new Set(prev);
    next.add(contact.id);
    return next;
  });
  setAnchorCell(null);
  setFocusCell(null);
  setClip(null);
  setMenu(null);
}

async function saveCell(id: string, key: string, value: string) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c))
    );
    markSaving();
    try {
      const res = await fetch(apiPath(`/api/contacts/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) markSaved();
      else markSaveError();
    } catch {
      markSaveError();
    }
  }

  async function persistCells(updates: Array<{ id: string; key: string; value: string }>) {
    if (updates.length === 0) return;

    // Registra o lote no histórico (capturando os valores anteriores) para que
    // colar / limpar / recortar / mesclar possam ser desfeitos e refeitos.
    const before = new Map(contacts.map((c) => [c.id, c]));
    recordBatch(
      updates.map((u) => ({
        id: u.id,
        key: u.key,
        prev: String(before.get(u.id)?.[u.key] ?? ""),
        next: u.value,
      }))
    );

    setContacts((prev) =>
      prev.map((contact) => {
        const contactUpdates = updates.filter((update) => update.id === contact.id);
        if (contactUpdates.length === 0) return contact;

        return contactUpdates.reduce<Contact>(
          (next, update) => ({ ...next, [update.key]: update.value }),
          contact
        );
      })
    );

    markSaving();
    try {
      // Agrupa por contato: 1 PATCH por linha com todos os campos. Assim, quando um
      // colar completa a linha (preenche vários campos da régua de uma vez), o servidor
      // recalcula a conclusão sobre o estado final — sem corrida entre requisições.
      const byId = new Map<string, Record<string, string>>();
      for (const u of updates) {
        const fields = byId.get(u.id) ?? {};
        fields[u.key] = u.value;
        byId.set(u.id, fields);
      }
      const results = await Promise.all(
        [...byId.entries()].map(([id, fields]) =>
          fetch(apiPath(`/api/contacts/${id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          })
        )
      );

      if (results.every((res) => res.ok)) markSaved();
      else markSaveError();
    } catch {
      markSaveError();
    }
  }

  async function mergeSelectedCells() {
    if (selectedCells.length < 2) return;

    const [first, ...rest] = selectedCells;
    const merged = Array.from(
      new Set(selectedCells.map((cell) => String(cell.contact[cell.key] || "").trim()).filter(Boolean))
    ).join(" / ");

    await persistCells([
      { id: first.contact.id, key: first.key, value: merged },
      ...rest.map((cell) => ({ id: cell.contact.id, key: cell.key, value: "" })),
    ]);
    selectAndFocus(first.row, first.col);
  }

  async function clearSelectedCells() {
    if (selectedCells.length === 0) return;

    await persistCells(selectedCells.map((cell) => ({ id: cell.contact.id, key: cell.key, value: "" })));
    focusGrid();
  }

  // Monta o TSV (linhas \n, colunas \t) da seleção atual — usado por copiar e recortar.
  function buildSelectionTSV(): string {
    if (!selBounds) return "";
    const { startRow, endRow, startCol, endCol } = selBounds;
    const lines: string[] = [];
    for (let row = startRow; row <= endRow; row++) {
      const contact = visible[row];
      if (!contact) continue;
      const values: string[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const key = fieldKeys[col];
        values.push(String(contact[key] || ""));
      }
      lines.push(values.join("\t"));
    }
    return lines.join("\n");
  }

  async function copySelectedCells() {
    if (selectedCells.length === 0 || !selBounds) return;
    await navigator.clipboard.writeText(buildSelectionTSV());
    setClip({
      mode: "copy",
      rect: { ...selBounds },
      cells: selectedCells.map((c) => ({ id: c.contact.id, key: c.key })),
    });
  }

  async function pasteGrid(
    row: number,
    col: number,
    text: string,
    transpose = false,
    fillRect?: { startRow: number; endRow: number; startCol: number; endCol: number } | null
  ) {
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.at(-1) === "") lines.pop();
    let matrix = lines.map((line) => line.split("\t"));
    if (transpose) {
      const nRows = matrix.length;
      const nCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
      const t: string[][] = [];
      for (let cI = 0; cI < nCols; cI++) {
        const r: string[] = [];
        for (let rI = 0; rI < nRows; rI++) r.push(matrix[rI][cI] ?? "");
        t.push(r);
      }
      matrix = t;
    }
    const updates: Array<{ id: string; key: string; value: string }> = [];

    // Excel/Sheets: copiar UMA célula e colar sobre uma seleção MAIOR preenche toda a seleção.
    const single = matrix.length === 1 && matrix[0].length === 1;
    const spansRange = fillRect && (fillRect.endRow > fillRect.startRow || fillRect.endCol > fillRect.startCol);
    if (single && spansRange && fillRect) {
      const v = (matrix[0][0] ?? "").trim();
      for (let r = fillRect.startRow; r <= fillRect.endRow; r++) {
        const contact = visible[r];
        if (!contact) continue;
        for (let cI = fillRect.startCol; cI <= fillRect.endCol; cI++) {
          const key = fieldKeys[cI];
          if (key) updates.push({ id: contact.id, key, value: v });
        }
      }
    } else {
      matrix.forEach((line, rowOffset) => {
        const contact = visible[row + rowOffset];
        if (!contact) return;
        line.forEach((value, colOffset) => {
          const key = fieldKeys[col + colOffset];
          if (!key) return;
          updates.push({ id: contact.id, key, value: value.trim() });
        });
      });
    }

    await persistCells(updates);
    return updates;
  }

  // Teclado da grade quando NÃO está editando (navegação estilo planilha).
  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (editingCell) return;

  const maxRow = visible.length - 1;
  const maxCol = fieldKeys.length - 1;
  if (maxRow < 0 || maxCol < 0) return;

  const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  const navKeys = [
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "F2",
  ];

  if (!focusCell) {
    if (navKeys.includes(e.key) || isPrintable) {
      e.preventDefault();
      selectCell(0, 0);
      if (isPrintable) startEditing(0, 0, e.key);
    }
    return;
  }

  const { row, col } = focusCell;
  const selectTarget = (nextRow: number, nextCol: number, extend = e.shiftKey) => {
    selectCell(
      Math.max(0, Math.min(maxRow, nextRow)),
      Math.max(0, Math.min(maxCol, nextCol)),
      extend
    );
  };

  const key = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (key === "a") {
      e.preventDefault();
      selectAll();
      return;
    }
    if (key === "c") {
      if (selectedCount > 0) {
        e.preventDefault();
        copySelectedCells();
      }
      return;
    }
    if (key === "x") {
      if (selectedCount > 0) {
        e.preventDefault();
        cutSelectedCells();
      }
      return;
    }
    if (key === "v") return;
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (key === "y") {
      e.preventDefault();
      redo();
      return;
    }
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectTarget(row + 1, col);
      return;
    case "ArrowUp":
      e.preventDefault();
      selectTarget(row - 1, col);
      return;
    case "ArrowLeft":
      e.preventDefault();
      selectTarget(row, col - 1);
      return;
    case "ArrowRight":
      e.preventDefault();
      selectTarget(row, col + 1);
      return;
    case "Home":
      e.preventDefault();
      selectTarget(e.ctrlKey || e.metaKey ? 0 : row, 0);
      return;
    case "End":
      e.preventDefault();
      selectTarget(e.ctrlKey || e.metaKey ? maxRow : row, maxCol);
      return;
    case "PageUp":
      e.preventDefault();
      selectTarget(row - 20, col);
      return;
    case "PageDown":
      e.preventDefault();
      selectTarget(row + 20, col);
      return;
    case "Tab": {
      e.preventDefault();
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      const nextRow = nextCol > maxCol ? row + 1 : nextCol < 0 ? row - 1 : row;
      const wrappedCol = nextCol > maxCol ? 0 : nextCol < 0 ? maxCol : nextCol;
      selectTarget(nextRow, wrappedCol, false);
      return;
    }
    case "Enter":
      e.preventDefault();
      selectTarget(e.shiftKey ? row - 1 : row + 1, col, false);
      return;
    case "F2":
      e.preventDefault();
      startEditing(row, col);
      return;
    case "Escape":
      e.preventDefault();
      setClip(null);
      setMenu(null);
      setPasteSpecialOpen(false);
      return;
    case "Backspace":
    case "Delete":
      if (selectedCount > 0) {
        e.preventDefault();
        clearSelectedCells();
      }
      return;
    default:
      break;
  }

  if (e.nativeEvent.isComposing || e.keyCode === 229 || e.key === "Dead" || e.key === "Process") return;
  if (isPrintable) {
    e.preventDefault();
    startEditing(row, col, e.key);
  }
}

  function handleGridCopy(e: React.ClipboardEvent<HTMLDivElement>) {
    if (editingCell || selectedCount === 0) return; // sem seleção: deixa a cópia nativa
    e.preventDefault();
    copySelectedCells();
  }

  function handleGridCut(e: React.ClipboardEvent<HTMLDivElement>) {
    if (editingCell || selectedCount === 0) return;
    e.preventDefault();
    cutSelectedCells();
  }

  function handleGridPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (editingCell || !selBounds) return;
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    // Cola a partir do canto superior-esquerdo da seleção (igual à barra de ferramentas).
    pasteGrid(selBounds.startRow, selBounds.startCol, text, false, selBounds).then(afterPaste);
  }

  async function addRow() {
  setClip(null);
    // Se estiver numa aba de UF específica, já cria o contato nesse estado.
    const estado = tab !== ALL && tab !== NO_UF ? tab : undefined;
    const res = await fetch(apiPath("/api/contacts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseId, estado }),
    });
    if (res.ok) {
      const c = await res.json();
      setContacts((prev) => [...prev, c]);
      setClip(null);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    // Base já tem dados → pergunta Substituir/Mesclar. Base vazia → importa direto.
    if (contacts.length > 0) {
      setPendingFile(file);
      return;
    }
    doImport(file, "merge");
  }

  async function doImport(file: File, mode: "merge" | "replace") {
    setPendingFile(null);
    setImporting(true);
    setMessage(null);
    setUndoInfo(null);
    const loadingId = toast.loading(
      mode === "replace" ? "Substituindo planilha…" : "Importando planilha…",
      "Lendo e gravando os contatos.",
    );
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    const res = await fetch(apiPath(`/api/bases/${baseId}/import`), { method: "POST", body: fd });
    setImporting(false);
    const data = await res.json();
    toast.dismiss(loadingId);
    if (res.ok) {
      const parts: string[] = [];
      if (data.imported) parts.push(`${data.imported} novo(s)`);
      if (data.completados) parts.push(`${data.completados} completado(s)`);
      if (data.substituidos) parts.push(`${data.substituidos} substituído(s)`);
      if (data.invalid) parts.push(`${data.invalid} com telefone inválido`);
      if (data.skippedNoChange) parts.push(`${data.skippedNoChange} sem mudança`);
      if (data.unknownColumns?.length) parts.push(`${data.unknownColumns.length} coluna(s) não reconhecida(s)`);
      const resumo = parts.join(" · ") || "Nada a importar";
      toast.success(mode === "replace" ? "Substituição concluída" : "Importação concluída", resumo);
      setMessage(resumo);
      if (data.eventoId) setUndoInfo({ eventoId: data.eventoId, resumo });
      router.refresh();
      if (data.imported > 0 || data.completados > 0) {
        // Dispara verificação CRM em background; o card da base atualiza ao terminar
        const syncId = toast.loading("Verificando no HubSpot CRM…", "Buscando contatos com telefone incorreto.");
        fetch(apiPath("/api/crm/sync?force=1"), { method: "POST" })
          .then(() => toast.update(syncId, { type: "success", title: "CRM sincronizado!", description: "Dados do HubSpot atualizados." }))
          .catch(() => toast.update(syncId, { type: "error", title: "CRM indisponível", description: "Sincronização automática pendente." }))
          .finally(() => router.refresh());
      }
    } else {
      const details = data.missingColumns?.length
        ? `Faltando: ${data.missingColumns.join(", ")}${
            data.unknownColumns?.length ? `. Não reconhecidas: ${data.unknownColumns.join(", ")}` : ""
          }`
        : data.error || `Erro ${res.status}.`;
      toast.error("Falha na importação", details);
      setMessage(details);
    }
  }

  async function desfazerImport() {
    if (!undoInfo) return;
    const loadingId = toast.loading("Desfazendo…");
    const res = await fetch(apiPath(`/api/bases/${baseId}/desfazer`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: undoInfo.eventoId }),
    });
    const data = await res.json().catch(() => ({}));
    toast.dismiss(loadingId);
    if (res.ok) {
      toast.success("Ação desfeita.", "A planilha voltou ao estado anterior.");
      setUndoInfo(null);
      setMessage(null);
      router.refresh();
    } else {
      toast.error("Não foi possível desfazer.", data.error || `Erro ${res.status}.`);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {undoInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span>Importação concluída · {undoInfo.resumo}</span>
          <button
            onClick={desfazerImport}
            className="rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Desfazer
          </button>
        </div>
      )}

      {pendingFile && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Substituir a planilha atual?</h2>
            <p className="mb-4 text-sm text-slate-500">
              Esta base já tem dados. Escolha como importar{" "}
              <strong className="text-slate-700">{pendingFile.name}</strong>:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => doImport(pendingFile, "merge")}
                className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="font-semibold text-slate-800">Não — mesclar (recomendado)</div>
                <div className="text-xs text-slate-500">
                  Mantém o que já existe, preenche só os campos vazios e adiciona os contatos novos. Não duplica.
                </div>
              </button>
              <button
                onClick={() => doImport(pendingFile, "replace")}
                className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-rose-300 hover:bg-rose-50"
              >
                <div className="font-semibold text-slate-800">Sim — substituir tudo</div>
                <div className="text-xs text-slate-500">
                  Troca todos os contatos e os rótulos de coluna pela nova planilha. É reversível (dá pra desfazer).
                </div>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setPendingFile(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1) Filtros de status + ações — ACIMA das abas de estado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "Todos", count: counts.all, dot: "bg-slate-400", active: "border-indigo-600 bg-indigo-50 text-indigo-700" },
            { key: STATUS_INCORRETO, label: STATUS_META[STATUS_INCORRETO].label, count: counts[STATUS_INCORRETO], dot: STATUS_META[STATUS_INCORRETO].dot, active: STATUS_META[STATUS_INCORRETO].active },
            { key: STATUS_ATUALIZADO, label: STATUS_META[STATUS_ATUALIZADO].label, count: counts[STATUS_ATUALIZADO], dot: STATUS_META[STATUS_ATUALIZADO].dot, active: STATUS_META[STATUS_ATUALIZADO].active },
            { key: STATUS_OK, label: STATUS_META[STATUS_OK].label, count: counts[STATUS_OK], dot: STATUS_META[STATUS_OK].dot, active: STATUS_META[STATUS_OK].active },
          ].map((f) => {
            const active = phoneFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setPhoneFilter(f.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  active ? f.active : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${f.dot}`} />
                {f.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/70" : "bg-slate-100"}`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <a
              href={apiPath(`/api/bases/${baseId}/export`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Exportar
            </a>
          )}
          {canImport && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15V3m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {importing ? "Importando..." : "Importar"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* 2) Paginação por estado (UF) */}
      {estados.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2">
          <button
            onClick={() => setTab(ALL)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              tab === ALL
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Todas <span className="text-xs text-slate-400">({filteredTotal})</span>
          </button>
          {estados.map(([uf, n]) => (
            <button
              key={uf}
              onClick={() => setTab(uf)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                tab === uf
                  ? "border-b-2 border-indigo-600 text-indigo-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {uf === NO_UF ? "Sem UF" : ufSigla(uf)} <span className="text-xs text-slate-400">({n})</span>
            </button>
          ))}
        </div>
      )}

      {/* 3) Barra de funcionalidades da planilha (estilo Google Sheets) */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
        {/* Buscar na planilha */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar na planilha"
            className="w-40 bg-transparent outline-none placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpar busca" className="text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>

        <ToolDivider />

        {/* Desfazer / Refazer */}
        <ToolBtn title="Desfazer" onClick={undo} disabled={history.length === 0}>
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 7 4 12l5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 12h11a5 5 0 0 1 0 10h-1" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>
        <ToolBtn title="Refazer" onClick={redo} disabled={redoStack.length === 0}>
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 7 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 12H9a5 5 0 0 0 0 10h1" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>

        <ToolDivider />

        {/* Mesclar células (recortar/copiar/colar/excluir ficam no menu do botão direito) */}
        <ToolBtn title="Mesclar células" onClick={mergeSelectedCells} disabled={selectedCount < 2}>
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14M15 5v14M3 12h6m6 0h6" /><path d="m10.5 10 2 2-2 2M13.5 10l-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>

        <ToolDivider />

        {/* Formatação: negrito / itálico / tachado */}
        <Tooltip label="Negrito">
          <button
            type="button"
            aria-label="Negrito"
            onClick={toggleBold}
            disabled={selectedCount === 0}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold transition hover:bg-slate-100 disabled:opacity-40 ${selectionAllHave((f) => !!f.b) ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
          >
            B
          </button>
        </Tooltip>
        <Tooltip label="Itálico">
          <button
            type="button"
            aria-label="Itálico"
            onClick={toggleItalic}
            disabled={selectedCount === 0}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm italic transition hover:bg-slate-100 disabled:opacity-40 ${selectionAllHave((f) => !!f.i) ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
          >
            I
          </button>
        </Tooltip>
        <Tooltip label="Tachado">
          <button
            type="button"
            aria-label="Tachado"
            onClick={toggleStrike}
            disabled={selectedCount === 0}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm line-through transition hover:bg-slate-100 disabled:opacity-40 ${selectionAllHave((f) => !!f.s) ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
          >
            S
          </button>
        </Tooltip>

        {/* Cor do texto */}
        <Tooltip label="Cor do texto">
          <label
            aria-label="Cor do texto"
            className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-md transition hover:bg-slate-100 ${selectedCount === 0 ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
          >
            <span className="text-sm font-bold leading-none text-slate-700">A</span>
            <span className="absolute bottom-1 h-1 w-4 rounded bg-slate-800" />
            <input type="color" onChange={(e) => setTextColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </Tooltip>

        {/* Cor de preenchimento */}
        <Tooltip label="Cor de preenchimento">
          <label
            aria-label="Cor de preenchimento"
            className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-md transition hover:bg-slate-100 ${selectedCount === 0 ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
          >
            <svg className="h-[18px] w-[18px] text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 3 9 9-7 7a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L9 3Z" strokeLinejoin="round" /><path d="M20 16s2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 2-4 2-4Z" /></svg>
            <input type="color" onChange={(e) => setFillColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </Tooltip>

        <ToolDivider />

        {/* Alinhamento */}
        {([
          { v: "left", d: "M4 6h16M4 12h10M4 18h13" },
          { v: "center", d: "M4 6h16M7 12h10M5 18h14" },
          { v: "right", d: "M4 6h16M10 12h10M7 18h13" },
        ] as const).map((a) => {
          const lbl = `Alinhar à ${a.v === "left" ? "esquerda" : a.v === "center" ? "centro" : "direita"}`;
          return (
          <Tooltip key={a.v} label={lbl}>
            <button
              type="button"
              aria-label={lbl}
              onClick={() => setAlign(a.v)}
              disabled={selectedCount === 0}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-md transition hover:bg-slate-100 disabled:opacity-40 ${selectionAllHave((f) => (f.align || "left") === a.v) ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={a.d} strokeLinecap="round" /></svg>
            </button>
          </Tooltip>
          );
        })}

        <ToolDivider />

        {/* Inserir linha */}
        <ToolBtn title="Inserir linha (novo contato)" onClick={addRow}>
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" /><path d="M12 11v6M9 14h6" strokeLinecap="round" /></svg>
        </ToolBtn>

        <ToolDivider />

        {/* Congelar 1ª coluna */}
        <ToolBtn title={frozen ? "Descongelar 1ª coluna" : "Congelar 1ª coluna"} onClick={() => setFrozen((v) => !v)}>
          <svg className={`h-[18px] w-[18px] ${frozen ? "text-indigo-600" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M3 9h6M3 14h6" /></svg>
        </ToolBtn>

        {/* Mostrar colunas ocultas (aparece só quando há colunas ocultas) */}
        {hiddenColumns.size > 0 && (
          <button
            type="button"
            onClick={showAllColumns}
            title="Mostrar colunas ocultas"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg>
            Mostrar {hiddenColumns.size} oculta{hiddenColumns.size > 1 ? "s" : ""}
          </button>
        )}

        {/* Densidade (zoom das linhas) */}
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value as "compacta" | "normal" | "ampla")}
          title="Densidade das linhas"
          className="h-9 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none hover:bg-slate-50"
        >
          <option value="compacta">Compacta</option>
          <option value="normal">Normal</option>
          <option value="ampla">Ampla</option>
        </select>

        <ToolDivider />

        {/* Σ contador da seleção */}
        <span className="flex shrink-0 items-center gap-1.5 px-2 text-sm text-slate-500">
          <svg className="h-[18px] w-[18px] text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 5H7l6 7-6 7h11" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {selectedCount > 0 ? `${selectedCount} célula(s)` : `${visible.length} linha(s)`}
        </span>

        <button
          type="button"
          onClick={() => setHistoricoOpen(true)}
          title="Histórico de alterações desta planilha"
          aria-label="Histórico de alterações"
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
            <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {historicoOpen && (
        <HistoricoModal
          baseId={baseId}
          onClose={() => setHistoricoOpen(false)}
          onReverted={(contactId, data) =>
            setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, ...(data as Partial<Contact>) } : c)))
          }
        />
      )}

      {message && (
        <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</span>
      )}

      {/* 4) Tabela editável */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onCopy={handleGridCopy}
        onCut={handleGridCut}
        onPaste={handleGridPaste}
        onMouseUp={() => setIsDragging(false)}
        className="min-h-0 flex-1 overflow-auto rounded-2xl bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300"
      >
        <table className="text-sm [&_td]:border-b [&_td]:border-r [&_td]:border-slate-300 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-300">
          <thead className="sticky top-0 z-30">
            {/* Letras das colunas (A, B, C…) — estilo planilha */}
            <tr className="border-b border-slate-200 bg-slate-100 text-center text-[11px] font-semibold text-slate-500">
              <th
                onClick={selectAll}
                title="Selecionar tudo"
                className="sticky left-0 z-30 w-12 min-w-[3rem] cursor-pointer bg-emerald-700 px-1 py-1 hover:bg-emerald-800"
              >
                <span className="inline-block h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-white/70 align-middle" />
              </th>
              {visibleFields.map((col, i) => {
                const activeCol = !!selBounds && i >= selBounds.startCol && i <= selBounds.endCol;
                return (
                  <th
                    key={col.key}
                    onClick={(e) => selectColumn(i, e.shiftKey)}
                    onContextMenu={(e) => openColumnContextMenu(e, i)}
                    title={`Selecionar coluna ${colLetter(i)}`}
                    className={`relative cursor-pointer px-1 py-1 ${
                      activeCol ? "bg-emerald-800 text-white" : "bg-emerald-700 text-white hover:bg-emerald-800"
                    } ${frozen && i === 0 ? "sticky z-20" : ""}`}
                    style={{ width: colW(col), minWidth: colW(col), ...(frozen && i === 0 ? { left: 48 } : {}) }}
                  >
                    {colLetter(i)}
                    <span
                      onMouseDown={(e) => startColResize(e, col)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        autoFitColumn(col);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Arraste para redimensionar · duplo-clique para ajustar"
                      className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-white/50"
                    />
                  </th>
                );
              })}
              <th className="bg-emerald-700 px-2 py-1" />
            </tr>
            {/* Rótulos das colunas */}
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="sticky left-0 z-30 w-12 min-w-[3rem] bg-emerald-700 px-1 py-3 font-semibold text-white">
                1
              </th>
              {visibleFields.map((col, i) => {
                const label = headerLabelFor(col.key, col.label);
                return (
                  <th
                    key={col.key}
                    className={`bg-slate-50 px-2 py-2 font-medium ${frozen && i === 0 ? "sticky z-20" : ""}`}
                    style={{ minWidth: colW(col), ...(frozen && i === 0 ? { left: 48 } : {}) }}
                  >
                    {canEditHeaders ? (
                      <input
                        defaultValue={label}
                        title="Editar cabeçalho"
                        aria-label={`Editar cabeçalho ${label}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => saveHeaderLabel(col.key, col.label, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            e.currentTarget.value = label;
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs font-medium uppercase text-slate-500 outline-none transition hover:border-slate-200 hover:bg-white focus:border-indigo-300 focus:bg-white focus:text-slate-700 focus:ring-2 focus:ring-indigo-100"
                      />
                    ) : (
                      <span className="block w-full px-1 py-1 text-xs font-medium uppercase text-slate-500" title={label}>
                        {label}
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="bg-slate-50 px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length + 2} className="px-3 py-10 text-center text-slate-400">
                  {contacts.length === 0
                    ? "Nenhum contato. Importe uma planilha ou adicione manualmente."
                    : "Nenhum contato neste estado."}
                </td>
              </tr>
            ) : (
              visible.map((c, rowIndex) => {
                const rowActive = !!selBounds && rowIndex >= selBounds.startRow && rowIndex <= selBounds.endRow;
                return (
                <tr key={c.id} className="hover:bg-slate-50">
                  {/* Número da linha (clique seleciona a linha inteira) */}
                  <td
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectRow(rowIndex, e.shiftKey);
                    }}
                    onContextMenu={(e) => openRowContextMenu(e, rowIndex)}
                    title="Selecionar linha inteira"
                    className={`sticky left-0 z-10 w-12 min-w-[3rem] cursor-pointer select-none border-r border-slate-300 px-1 text-center text-xs ${padY} ${
                      rowActive
                        ? "bg-emerald-800 font-semibold text-white"
                        : "bg-emerald-700 text-white hover:bg-emerald-800"
                    }`}
                  >
                    {rowIndex + 2}
                  </td>
                  {visibleFields.map((col, colIndex) => {
                    const f = fmtOf(c.id, col.key);
                    const selectedCell = isSelected(rowIndex, colIndex);
                    const isActiveCell = focusCell?.row === rowIndex && focusCell?.col === colIndex;
                    const editing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                    const value = (c[col.key] as string) || "";
                    // Marca-d'água de copiar/recortar (tracejado nas bordas do retângulo).
                    const inClip =
                      !!clip &&
                      rowIndex >= clip.rect.startRow && rowIndex <= clip.rect.endRow &&
                      colIndex >= clip.rect.startCol && colIndex <= clip.rect.endCol;
                    const ant = "1.5px dashed #4f46e5";
                    const clipStyle = inClip && clip
                      ? {
                          ...(rowIndex === clip.rect.startRow ? { borderTop: ant } : {}),
                          ...(rowIndex === clip.rect.endRow ? { borderBottom: ant } : {}),
                          ...(colIndex === clip.rect.startCol ? { borderLeft: ant } : {}),
                          ...(colIndex === clip.rect.endCol ? { borderRight: ant } : {}),
                        }
                      : {};
                    return (
                    <td
                      key={col.key}
                      className={`px-1 ${padY} ${
                        selectedCell
                          ? isActiveCell
                            ? "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
                            : "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                          : ""
                      } ${frozen && colIndex === 0 ? "sticky z-10" : ""}`}
                      style={{
                        ...(frozen && colIndex === 0 ? { left: 48 } : {}),
                        ...(frozen && colIndex === 0 && !selectedCell && !f.bg ? { backgroundColor: "#ffffff" } : {}),
                        ...(f.bg && !selectedCell ? { backgroundColor: f.bg } : {}),
                        ...clipStyle,
                      }}
                      onContextMenu={(e) => openContextMenu(e, rowIndex, colIndex)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return; // botão direito: tratado por onContextMenu
                        if (editing) return; // editando esta célula: deixa o cursor do input
                        if (editingCell) {
                          // Outra célula está em edição: não previne o default p/ o blur salvar.
                          setIsDragging(true);
                          selectCell(rowIndex, colIndex, e.shiftKey);
                          focusGrid();
                          return;
                        }
                        e.preventDefault();
                        setIsDragging(true);
                        selectCell(rowIndex, colIndex, e.shiftKey);
                        gridRef.current?.focus();
                      }}
                      onMouseEnter={(e) => {
                        // Estende a seleção enquanto o botão estiver pressionado —
                        // inclusive ao retornar à grade após o ponteiro sair dela.
                        if ((isDragging || e.buttons === 1) && anchorCell) {
                          if (!isDragging) setIsDragging(true);
                          setFocusCell({ row: rowIndex, col: colIndex });
                        }
                      }}
                      onDoubleClick={() => startEditing(rowIndex, colIndex)}
                    >
                      {editing ? (
                        <input
                          key={`edit:${c.id}:${col.key}`}
                          autoFocus
                          data-grid-cell={`${rowIndex}:${colIndex}`}
                          defaultValue={editSeed ?? value}
                          onFocus={(e) => {
                            const el = e.currentTarget;
                            if (editSeed != null) {
                              const end = el.value.length;
                              el.setSelectionRange(end, end);
                            } else {
                              el.select();
                            }
                          }}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if (next !== value) {
                              recordEdit({ id: c.id, key: col.key, prev: value, next });
                              saveCell(c.id, col.key, next);
                            }
                            stopEditing(false);
                          }}
                          onKeyDown={(e) => {
                            const maxRow = visible.length - 1;
                            const maxCol = fieldKeys.length - 1;
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                              selectAndFocus(Math.min(maxRow, rowIndex + 1), colIndex);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.currentTarget.value = value;
                              e.currentTarget.blur();
                              selectAndFocus(rowIndex, colIndex);
                            } else if (e.key === "Tab") {
                              // Nas bordas, comita (blur) e deixa o foco sair da grade.
                              const atForwardEdge = !e.shiftKey && rowIndex === maxRow && colIndex === maxCol;
                              const atBackwardEdge = e.shiftKey && rowIndex === 0 && colIndex === 0;
                              if (atForwardEdge || atBackwardEdge) return;
                              e.preventDefault();
                              e.currentTarget.blur();
                              const target = e.shiftKey ? colIndex - 1 : colIndex + 1;
                              const nextCol = target > maxCol ? 0 : target < 0 ? maxCol : target;
                              const nextRow =
                                target > maxCol ? Math.min(maxRow, rowIndex + 1) : target < 0 ? Math.max(0, rowIndex - 1) : rowIndex;
                              selectAndFocus(nextRow, nextCol);
                            }
                          }}
                          style={{
                            minWidth: colW(col),
                            fontWeight: f.b ? 700 : undefined,
                            fontStyle: f.i ? "italic" : undefined,
                            textDecoration: f.s ? "line-through" : undefined,
                            color: f.color || undefined,
                            textAlign: f.align || undefined,
                          }}
                          className={`w-full rounded border border-indigo-400 bg-white px-2 ${padY} outline-none ${
                            !f.color && col.key === "telefonePrefeitura" && c.status === STATUS_INCORRETO
                              ? "text-amber-700"
                              : "text-slate-700"
                          }`}
                        />
                      ) : (
                        <div
                          data-grid-cell={`${rowIndex}:${colIndex}`}
                          style={{
                            width: colW(col),
                            maxWidth: colW(col),
                            fontWeight: f.b ? 700 : undefined,
                            fontStyle: f.i ? "italic" : undefined,
                            textDecoration: f.s ? "line-through" : undefined,
                            color: f.color || undefined,
                            textAlign: f.align || undefined,
                          }}
                          className={`select-none whitespace-normal break-words rounded border border-transparent px-2 ${padY} ${
                            !f.color && col.key === "telefonePrefeitura" && c.status === STATUS_INCORRETO
                              ? "text-amber-700"
                              : "text-slate-700"
                          }`}
                        >
                          {value || " "}
                        </div>
                      )}
                    </td>
                    );
                  })}
                  <td className="px-3 py-1">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Menu de contexto (botão direito) */}
      {menu && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onMouseDown={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div
            className="fixed z-[61] min-w-[232px] rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl"
            style={{
              top: Math.min(menu.y, window.innerHeight - 220),
              left: Math.min(menu.x, window.innerWidth - 252),
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {menu.type === "column" ? (
              <>
                <MenuRow
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                    </svg>
                  }
                  label="Limpar coluna"
                  onClick={() => clearColumn(menu.col)}
                />
                <MenuRow
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3l18 18" strokeLinecap="round" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" strokeLinecap="round" />
                      <path d="M9.5 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a12.2 12.2 0 0 1-2.3 3.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.6 6.7A12.4 12.4 0 0 0 2.5 12C3.5 14.5 7 19 12 19a10.8 10.8 0 0 0 4.1-.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  label="Ocultar coluna"
                  onClick={() => hideColumn(menu.col)}
                />
              </>
            ) : (
              <>
            <MenuRow
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5 20 18M8.5 16.5 20 6" strokeLinecap="round" /></svg>
              }
              label="Recortar"
              shortcut="⌘X"
              disabled={selectedCount === 0}
              onClick={() => {
                cutSelectedCells();
                setMenu(null);
              }}
            />
            <MenuRow
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              }
              label="Copiar"
              shortcut="⌘C"
              disabled={selectedCount === 0}
              onClick={() => {
                copySelectedCells();
                setMenu(null);
              }}
            />
            <MenuRow
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="4" width="12" height="16" rx="2" /><rect x="9" y="2.5" width="6" height="4" rx="1" /></svg>
              }
              label="Colar"
              shortcut="⌘V"
              onClick={() => {
                pasteFromClipboard();
                setMenu(null);
              }}
            />
            <div
              className="relative"
              onMouseEnter={() => setPasteSpecialOpen(true)}
              onMouseLeave={() => setPasteSpecialOpen(false)}
            >
              <MenuRow
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="4" width="12" height="16" rx="2" /><rect x="9" y="2.5" width="6" height="4" rx="1" /></svg>
                }
                label="Colar especial"
                arrow
              />
              {pasteSpecialOpen && (
                <div className="absolute left-full top-0 -ml-1 min-w-[208px] rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl">
                  <MenuRow
                    label="Colar valores apenas"
                    onClick={() => {
                      pasteSpecial(false);
                      setMenu(null);
                    }}
                  />
                  <MenuRow
                    label="Colar transposto"
                    onClick={() => {
                      pasteSpecial(true);
                      setMenu(null);
                    }}
                  />
                </div>
              )}
            </div>
              <div className="my-1 h-px bg-slate-200" />
              <MenuRow
                icon={
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M9 10l6 4M15 10l-6 4" strokeLinecap="round" />
                  </svg>
                }
                label={selectedCount > 1 ? `Excluir ${selectedCount} células` : "Excluir célula"}
                disabled={selectedCount === 0}
                onClick={() => {
                  clearSelectedCells();
                  setMenu(null);
                }}
              />
              {menu.type === "row" && (
                <>
                  <div className="my-1 h-px bg-slate-200" />
                  <MenuRow
                    icon={<span className="text-xl leading-none">+</span>}
                    label="Inserir 1 linha acima"
                    onClick={() => insertRowNear(menu.row, "above")}
                  />
                  <MenuRow
                    icon={<span className="text-xl leading-none">+</span>}
                    label="Inserir 1 linha abaixo"
                    onClick={() => insertRowNear(menu.row, "below")}
                  />
                  {canDelete && (
                    <MenuRow
                      icon={
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18" strokeLinecap="round" />
                          <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11v5M14 11v5" strokeLinecap="round" />
                        </svg>
                      }
                      label="Excluir linha"
                      onClick={() => deleteRow(menu.row)}
                    />
                  )}
                  <MenuRow
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                      </svg>
                    }
                    label="Limpar linha"
                    onClick={() => clearRow(menu.row)}
                  />
                  <MenuRow
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18" strokeLinecap="round" />
                        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" strokeLinecap="round" />
                        <path d="M9.5 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a12.2 12.2 0 0 1-2.3 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6.6 6.7A12.4 12.4 0 0 0 2.5 12C3.5 14.5 7 19 12 19a10.8 10.8 0 0 0 4.1-.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                    label="Ocultar linha"
                    onClick={() => hideRow(menu.row)}
                  />
                </>
              )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
