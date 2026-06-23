"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/path";
import { CONTACT_FIELDS } from "@/lib/contact-fields";
import { STATUS_META, STATUS_OK, STATUS_INCORRETO, STATUS_ATUALIZADO } from "@/lib/status";
import { useToast } from "@/components/Toast";

type Contact = {
  id: string;
  status: string;
  [key: string]: string | null | undefined;
};

type CellRef = {
  row: number;
  col: number;
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_META[status] || STATUS_META[STATUS_OK];
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${s.badge}`}>{s.label}</span>
  );
}

export default function ContactsTable({
  baseId,
  initialContacts,
  canDelete = true,
  canImport = true,
  canExport = true,
}: {
  baseId: string;
  initialContacts: Contact[];
  canDelete?: boolean;
  canImport?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [anchorCell, setAnchorCell] = useState<CellRef | null>(null);
  const [focusCell, setFocusCell] = useState<CellRef | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ALL = "__all__";
  const NO_UF = "__no_uf__";
  const fieldKeys = useMemo(() => CONTACT_FIELDS.map((field) => field.key), []);

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

  // Conjunto da aba (UF) selecionada — base para as contagens dos 3 filtros.
  const byState = useMemo(() => {
    if (tab === ALL) return contacts;
    return contacts.filter((c) => ufOf(c) === tab);
  }, [contacts, tab]);

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

  const visible = useMemo(() => byState.filter(matchesPhone), [byState, matchesPhone]);

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

  function isSelected(row: number, col: number) {
    if (!anchorCell || !focusCell) return false;

    const startRow = Math.min(anchorCell.row, focusCell.row);
    const endRow = Math.max(anchorCell.row, focusCell.row);
    const startCol = Math.min(anchorCell.col, focusCell.col);
    const endCol = Math.max(anchorCell.col, focusCell.col);

    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }

  function focusGridCell(row: number, col: number) {
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-grid-cell="${row}:${col}"]`);
      input?.focus();
      input?.select();
    });
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

  async function saveCell(id: string, key: string, value: string) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c))
    );
    try {
      const res = await fetch(apiPath(`/api/contacts/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) toast.success("Salvo");
      else toast.error("Não foi possível salvar", `Erro ${res.status}.`);
    } catch (e) {
      toast.error("Não foi possível salvar", (e as Error).message);
    }
  }

  async function persistCells(updates: Array<{ id: string; key: string; value: string }>, successMessage: string) {
    if (updates.length === 0) return;

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

    try {
      const results = await Promise.all(
        updates.map((update) =>
          fetch(apiPath(`/api/contacts/${update.id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [update.key]: update.value }),
          })
        )
      );

      if (results.every((res) => res.ok)) toast.success(successMessage);
      else toast.error("Algumas células não foram salvas.");
    } catch (e) {
      toast.error("Não foi possível salvar", (e as Error).message);
    }
  }

  async function mergeSelectedCells() {
    if (selectedCells.length < 2) {
      toast.error("Selecione ao menos duas células.");
      return;
    }

    const [first, ...rest] = selectedCells;
    const merged = Array.from(
      new Set(selectedCells.map((cell) => String(cell.contact[cell.key] || "").trim()).filter(Boolean))
    ).join(" / ");

    await persistCells(
      [
        { id: first.contact.id, key: first.key, value: merged },
        ...rest.map((cell) => ({ id: cell.contact.id, key: cell.key, value: "" })),
      ],
      "Células mescladas"
    );
    focusGridCell(first.row, first.col);
  }

  async function clearSelectedCells() {
    if (selectedCells.length === 0) return;

    await persistCells(
      selectedCells.map((cell) => ({ id: cell.contact.id, key: cell.key, value: "" })),
      "Células limpas"
    );
    if (anchorCell) focusGridCell(anchorCell.row, anchorCell.col);
  }

  async function copySelectedCells() {
    if (selectedCells.length === 0 || !anchorCell || !focusCell) return;

    const startRow = Math.min(anchorCell.row, focusCell.row);
    const endRow = Math.max(anchorCell.row, focusCell.row);
    const startCol = Math.min(anchorCell.col, focusCell.col);
    const endCol = Math.max(anchorCell.col, focusCell.col);
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

    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Seleção copiada");
  }

  async function pasteGrid(row: number, col: number, text: string) {
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.at(-1) === "") lines.pop();
    const matrix = lines.map((line) => line.split("\t"));
    const updates: Array<{ id: string; key: string; value: string }> = [];

    matrix.forEach((line, rowOffset) => {
      const contact = visible[row + rowOffset];
      if (!contact) return;

      line.forEach((value, colOffset) => {
        const key = fieldKeys[col + colOffset];
        if (!key) return;
        updates.push({ id: contact.id, key, value: value.trim() });
      });
    });

    await persistCells(updates, `${updates.length} célula(s) colada(s)`);
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key === "Tab") {
      e.preventDefault();
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      const nextRow = nextCol >= fieldKeys.length ? row + 1 : nextCol < 0 ? row - 1 : row;
      const normalizedCol = nextCol >= fieldKeys.length ? 0 : nextCol < 0 ? fieldKeys.length - 1 : nextCol;
      selectCell(nextRow, normalizedCol);
      focusGridCell(nextRow, normalizedCol);
    }
  }

  async function addRow() {
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
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Remover este contato?")) return;
    const res = await fetch(apiPath(`/api/contacts/${id}`), { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contato removido");
    } else {
      toast.error("Não foi possível remover", res.status === 403 ? "Sem permissão." : `Erro ${res.status}.`);
    }
  }

  async function flagPhone(id: string) {
    const reason = prompt("Motivo (ex.: número incompleto, não atende):", "Telefone incorreto");
    if (reason === null) return;
    const res = await fetch(apiPath(`/api/contacts/${id}/flag`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: STATUS_INCORRETO } : c))
      );
      toast.success("Telefone marcado como incorreto", "Enviado para a fila de correção.");
    } else {
      toast.error("Não foi possível marcar", `Erro ${res.status}.`);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    const loadingId = toast.loading("Importando planilha…", "Lendo e gravando os contatos.");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiPath(`/api/bases/${baseId}/import`), {
      method: "POST",
      body: fd,
    });
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    const data = await res.json();
    toast.dismiss(loadingId);
    if (res.ok) {
      const skipped = (data.skippedExisting || 0) + (data.skippedInFile || 0) + (data.skippedWithoutKey || 0);
      const details = [
        `${data.imported} novo(s)`,
        `${skipped} duplicado(s)/ignorado(s)`,
        `${data.invalid} com telefone inválido`,
      ];
      if (data.unknownColumns?.length) details.push(`${data.unknownColumns.length} coluna(s) não reconhecida(s)`);
      toast.success("Importação concluída", details.join(" · "));
      setMessage(
        `Importação: ${data.imported} novo(s), ${skipped} ignorado(s). ${
          data.unknownColumns?.length ? `Colunas não reconhecidas: ${data.unknownColumns.join(", ")}.` : ""
        }`
      );
      router.refresh();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="order-2 flex items-center justify-between gap-3 overflow-x-auto rounded-full border border-slate-200 bg-slate-100 px-2 py-1 shadow-sm">
        {/* Esquerda: filtros por situação do telefone (nomenclatura do CRM) */}
        <div className="flex min-w-max items-center gap-1">
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

        {/* Direita: ações */}
        <div className="flex min-w-max items-center gap-2">
          {message && (
            <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
              {message}
            </span>
          )}
          {canExport && (
            <a
              href={apiPath(`/api/bases/${baseId}/export`)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ⬇️ Exportar CSV
            </a>
          )}
          {canImport && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {importing ? "Importando..." : "📥 Importar CSV/Excel"}
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
          <button
            onClick={addRow}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Adicionar contato
          </button>
          <button
            onClick={copySelectedCells}
            disabled={selectedCount === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Copiar
          </button>
          <button
            onClick={mergeSelectedCells}
            disabled={selectedCount < 2}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Mesclar
          </button>
          <button
            onClick={clearSelectedCells}
            disabled={selectedCount === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Paginação por estado (UF) */}
      {estados.length > 0 && (
        <div className="order-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-2">
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
              {uf === NO_UF ? "Sem UF" : uf} <span className="text-xs text-slate-400">({n})</span>
            </button>
          ))}
        </div>
      )}

      <div className="order-3 overflow-x-auto rounded-2xl bg-white shadow-sm" onMouseUp={() => setIsDragging(false)}>
        <table className="text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              {CONTACT_FIELDS.map((col) => (
                <th key={col.key} className="px-3 py-3 font-medium" style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="sticky right-0 bg-slate-50 px-3 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={CONTACT_FIELDS.length + 2} className="px-3 py-10 text-center text-slate-400">
                  {contacts.length === 0
                    ? "Nenhum contato. Importe uma planilha ou adicione manualmente."
                    : "Nenhum contato neste estado."}
                </td>
              </tr>
            ) : (
              visible.map((c, rowIndex) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {CONTACT_FIELDS.map((col, colIndex) => (
                    <td
                      key={col.key}
                      className={`px-1 py-1 ${isSelected(rowIndex, colIndex) ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : ""}`}
                      onMouseDown={(e) => {
                        setIsDragging(true);
                        selectCell(rowIndex, colIndex, e.shiftKey);
                      }}
                      onMouseEnter={() => {
                        if (isDragging) setFocusCell({ row: rowIndex, col: colIndex });
                      }}
                    >
                      <input
                        data-grid-cell={`${rowIndex}:${colIndex}`}
                        defaultValue={(c[col.key] as string) || ""}
                        onBlur={(e) => {
                          if (e.target.value !== ((c[col.key] as string) || "")) {
                            saveCell(c.id, col.key, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData("text");
                          if (text.includes("\t") || text.includes("\n")) {
                            e.preventDefault();
                            pasteGrid(rowIndex, colIndex, text);
                          }
                        }}
                        style={{ minWidth: col.width }}
                        className={`w-full rounded border border-transparent bg-transparent px-2 py-1 outline-none focus:border-indigo-400 focus:bg-white ${
                          col.key === "telefonePrefeitura" && c.status === STATUS_INCORRETO
                            ? "text-amber-700"
                            : "text-slate-700"
                        }`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="sticky right-0 whitespace-nowrap bg-white px-3 py-1 text-right">
                    <button
                      onClick={() => flagPhone(c.id)}
                      title="Marcar telefone como incorreto"
                      className="mr-1 rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50"
                    >
                      📞 errado
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteRow(c.id)}
                        title="Remover"
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
