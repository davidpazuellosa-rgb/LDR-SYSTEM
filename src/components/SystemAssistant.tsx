"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { apiPath } from "@/lib/path";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function SparkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SystemAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá. Sou o agente do sistema. Posso consultar contatos, correções, LDRs e bases sem acessar dados sensíveis.",
    },
  ]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(apiPath("/api/assistant"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-8) }),
      });
      const data = await res.json().catch(() => ({}));

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: res.ok ? data.answer || "Não encontrei uma resposta." : data.error || "Não consegui consultar agora.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `Não consegui consultar agora: ${(error as Error).message}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-[420px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white">
                <SparkIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Agente SASI</div>
                <div className="text-xs text-slate-400">Consulta segura do sistema</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Fechar agente"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="max-h-[420px] min-h-[300px] space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
                Consultando...
              </div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 bg-white p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder="Pergunte sobre contatos, LDRs ou correções..."
              className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
        aria-label="Abrir agente do sistema"
      >
        <SparkIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
