"use client";

import { useEffect, useRef, useState } from "react";
import { apiPath } from "@/lib/path";
import { useToast } from "@/components/Toast";

function BulbIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18h6M10 21h4" strokeLinecap="round" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2H14.5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" strokeLinejoin="round" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

const MAX_SECONDS = 120;

function pickMime() {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return "";
  return cands.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function SuggestionButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function stopRec() {
    clearTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    setRecording(false);
  }
  function discardAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioData(null);
    setSeconds(0);
  }
  function reset() {
    stopRec();
    stopStream();
    discardAudio();
    setText("");
    setError(null);
    setTranscribing(false);
  }

  // Limpa tudo ao desmontar.
  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "sugestao.webm");
      const res = await fetch(apiPath("/api/sugestoes/transcrever"), { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        setText((prev) => (prev.trim() ? `${prev.trim()}\n${data.text}` : data.text));
      } else if (!res.ok) {
        toast.error("Não consegui transcrever o áudio.", data.error || "O áudio foi mantido para envio.");
      }
    } catch {
      /* mantém o áudio mesmo sem transcrição */
    } finally {
      setTranscribing(false);
    }
  }

  async function startRec() {
    setError(null);
    discardAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        stopStream();
        if (!blob.size) return;
        setAudioUrl(URL.createObjectURL(blob));
        setAudioData(await blobToDataUrl(blob));
        transcribe(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stopRec();
          return Math.min(next, MAX_SECONDS);
        });
      }, 1000);
    } catch {
      setError("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  async function submit() {
    if (!text.trim() && !audioData) {
      setError("Escreva ou grave a sua sugestão.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/sugestoes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: text.trim(), audio: audioData }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Sugestão enviada!", "Obrigado — a equipe vai avaliar.");
        reset();
        setOpen(false);
      } else {
        setError(data.error || "Não foi possível enviar.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function close() {
    reset();
    setOpen(false);
  }

  return (
    <>
      {/* FAB acima do botão do chat (que fica em bottom-6). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Enviar sugestão de melhoria"
        aria-label="Enviar sugestão de melhoria"
        className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
      >
        <BulbIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Sugestão de melhoria</h2>
                <p className="mt-0.5 text-sm text-slate-500">Escreva ou grave um áudio — ele é transcrito automaticamente.</p>
              </div>
              <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Conte sua sugestão para melhorar o sistema…"
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />

              {/* Gravação de áudio */}
              <div className="flex flex-wrap items-center gap-3">
                {recording ? (
                  <button
                    onClick={stopRec}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    <StopIcon /> Parar ({fmt(seconds)})
                  </button>
                ) : (
                  <button
                    onClick={startRec}
                    disabled={transcribing || sending}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
                  >
                    <MicIcon /> {audioData ? "Regravar" : "Gravar áudio"}
                  </button>
                )}
                {recording && (
                  <span className="inline-flex items-center gap-2 text-sm text-red-600">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> gravando…
                  </span>
                )}
                {transcribing && <span className="text-sm text-slate-400">Transcrevendo…</span>}
              </div>

              {audioUrl && !recording && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <audio src={audioUrl} controls className="h-9 flex-1" />
                  <button onClick={discardAudio} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remover áudio">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              )}

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={close} disabled={sending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={submit} disabled={sending || recording || transcribing} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {sending ? "Enviando…" : "Enviar sugestão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
