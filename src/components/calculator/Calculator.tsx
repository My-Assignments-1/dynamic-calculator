import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy, Trash2, History, Palette, RotateCw, Check, X, ClipboardPaste,
} from "lucide-react";
import { evaluate, formatResult, type AngleMode } from "@/lib/calc-engine";
import { THEMES, type CalcTheme } from "@/lib/themes";
import { toast } from "sonner";

interface HistoryEntry {
  id: number;
  expr: string;
  result: string;
}

const BASIC_KEYS = [
  ["C", "(", ")", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "⌫", "="],
];

const SCI_KEYS = [
  ["sin", "cos", "tan", "π"],
  ["asin", "acos", "atan", "e"],
  ["log", "ln", "√", "^"],
  ["x²", "x³", "1/x", "!"],
  ["abs", "exp", "%", "EE"],
];

export function Calculator() {
  const [expr, setExpr] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  const [theme, setTheme] = useState<CalcTheme>(THEMES[0]!);
  const [showHistory, setShowHistory] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [forceSci, setForceSci] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const sciVisible = landscape || forceSci;

  const livePreview = useCallback((e: string, mode: AngleMode) => {
    if (!e || !/[0-9)]$/.test(e)) { setPreview(null); return; }
    try {
      const v = evaluate(e, mode);
      setPreview(formatResult(v));
    } catch {
      setPreview(null);
    }
  }, []);

  const OPERATORS = ["+", "−", "×", "÷", "%", "^"];

  const push = (s: string) => {
    setError(null);
    setExpr((prev) => {
      const base = justEvaluated ? (/[0-9.πe!]$/.test(s) ? "" : prev) : prev;
      let nextExpr: string;
      // Fix 1: ignore a second decimal point within the same number
      if (s === "." && /\d*\.\d*$/.test(base) && /\.\d*$/.test(base)) {
        nextExpr = base;
      // Fix 2: replace a trailing operator instead of stacking operators
      } else if (OPERATORS.includes(s) && base.length > 0 && OPERATORS.includes(base.slice(-1))) {
        nextExpr = base.slice(0, -1) + s;
      } else {
        nextExpr = base + s;
      }
      livePreview(nextExpr, angleMode);
      return nextExpr;
    });
    setJustEvaluated(false);
  };

  const backspace = () => {
    setError(null);
    setExpr((prev) => {
      const nextExpr = prev.slice(0, -1);
      livePreview(nextExpr, angleMode);
      return nextExpr;
    });
    setJustEvaluated(false);
  };

  const clear = () => { setExpr(""); setPreview(null); setError(null); setJustEvaluated(false); };

  const equals = () => {
    if (!expr) return;
    try {
      const v = evaluate(expr, angleMode);
      const result = formatResult(v);
      setHistory((h) => [{ id: ++idRef.current, expr, result }, ...h].slice(0, 50));
      setExpr(result);
      setPreview(null);
      setError(null);
      setJustEvaluated(true);
    } catch (err) {
      // Fix 3: show a clear message for division by zero
      if (err instanceof Error && err.message === "÷ by 0") {
        setPreview(null);
        setError("Cannot divide by zero");
      } else {
        toast.error("Invalid expression");
      }
    }
  };

  const handleKey = (k: string) => {
    if (k === "C") return clear();
    if (k === "⌫") return backspace();
    if (k === "=") return equals();
    push(k);
  };

  const handleSci = (k: string) => {
    switch (k) {
      case "sin": case "cos": case "tan": case "asin": case "acos": case "atan":
      case "log": case "ln": case "abs": case "exp":
        return push(`${k}(`);
      case "√": return push("sqrt(");
      case "π": return push("π");
      case "x²": return push("^2");
      case "x³": return push("^3");
      case "1/x": return push("^(−1)");
      case "EE": return push("e");
      default: return push(k);
    }
    return undefined;
  };

  const copyText = async (text: string, label = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Copy failed");
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim().replace(/[^0-9+\-*/^%().!a-zπ×÷−]/gi, "");
      if (!cleaned) { toast.error("Clipboard has no usable expression"); return; }
      push(cleaned);
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const toggleAngle = () => {
    const nextMode: AngleMode = angleMode === "deg" ? "rad" : "deg";
    setAngleMode(nextMode);
    livePreview(expr, nextMode);
  };

  const v = theme.vars;
  const themeStyle = {
    "--background": v.background,
    "--foreground": v.foreground,
    "--card": v.card,
    "--card-foreground": v.cardForeground,
    "--primary": v.primary,
    "--primary-foreground": v.primaryForeground,
    "--secondary": v.secondary,
    "--secondary-foreground": v.secondaryForeground,
    "--muted": v.muted,
    "--muted-foreground": v.mutedForeground,
    "--accent": v.accent,
    "--accent-foreground": v.accentForeground,
    "--border": v.border,
  } as React.CSSProperties;

  const keyBtn =
    "flex h-14 items-center justify-center rounded-2xl text-xl font-medium transition-all active:scale-95 select-none";

  return (
    <div
      style={themeStyle}
      className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAngle}
            className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground"
          >
            {angleMode}
          </button>
          <button
            onClick={() => setForceSci((s) => !s)}
            aria-label="Toggle scientific panel"
            className={`rounded-full p-2 transition-colors ${sciVisible ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pasteFromClipboard}
            aria-label="Paste from clipboard"
            className="rounded-full bg-secondary p-2 text-secondary-foreground"
          >
            <ClipboardPaste className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowThemes((s) => !s); setShowHistory(false); }}
            aria-label="Change theme"
            className="rounded-full bg-secondary p-2 text-secondary-foreground"
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowHistory((s) => !s); setShowThemes(false); }}
            aria-label="History and clipboard"
            className="rounded-full bg-secondary p-2 text-secondary-foreground"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Theme picker */}
      {showThemes && (
        <div className="mx-4 mt-3 animate-scale-in rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-card-foreground">Theme</span>
            <button onClick={() => setShowThemes(false)} aria-label="Close themes">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: t.swatch,
                    borderColor: t.id === theme.id ? v.foreground : "transparent",
                  }}
                >
                  {t.id === theme.id && <Check className="h-4 w-4" style={{ color: t.vars.primaryForeground }} />}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History / clipboard panel */}
      {showHistory && (
        <div className="mx-4 mt-3 max-h-56 animate-scale-in overflow-y-auto rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-card-foreground">History</span>
            <div className="flex gap-2">
              <button onClick={() => setHistory([])} aria-label="Clear history">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setShowHistory(false)} aria-label="Close history">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No calculations yet</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => { setExpr(h.result); setShowHistory(false); setJustEvaluated(true); }}
                  >
                    <div className="truncate text-xs text-muted-foreground">{h.expr}</div>
                    <div className="truncate text-sm font-semibold text-card-foreground">{h.result}</div>
                  </button>
                  <button
                    onClick={() => copyText(h.result)}
                    aria-label="Copy result"
                    className="rounded-full bg-secondary p-1.5 text-secondary-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Display */}
      <div className="flex flex-1 flex-col items-end justify-end gap-1 px-6 py-6">
        <div className="w-full overflow-x-auto text-right">
          <div className="whitespace-nowrap text-4xl font-light tracking-tight">
            {expr || <span className="text-muted-foreground">0</span>}
          </div>
        </div>
        <div className="flex h-8 w-full items-center justify-end gap-3">
          {error ? (
            <span role="alert" className="text-xl text-destructive">{error}</span>
          ) : preview && preview !== expr && (
            <span className="text-xl text-muted-foreground">= {preview}</span>
          )}
          {expr && (
            <button
              onClick={() => copyText(preview && preview !== expr ? preview : expr)}
              aria-label="Copy display"
              className="rounded-full bg-secondary p-1.5 text-secondary-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Keypads */}
      <div className={`px-4 pb-6 ${sciVisible ? "grid grid-cols-2 gap-3" : ""}`}>
        {sciVisible && (
          <div className="grid grid-cols-4 gap-2">
            {SCI_KEYS.flat().map((k) => (
              <button
                key={k}
                onClick={() => handleSci(k)}
                className={`${keyBtn} h-11 rounded-xl bg-muted text-sm text-muted-foreground hover:bg-secondary`}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {BASIC_KEYS.flat().map((k) => {
            const isOp = ["÷", "×", "−", "+", "="].includes(k);
            const isUtil = ["C", "(", ")", "⌫"].includes(k);
            return (
              <button
                key={k}
                onClick={() => handleKey(k)}
                className={`${keyBtn} ${
                  k === "="
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : isOp
                      ? "bg-accent text-accent-foreground"
                      : isUtil
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-card text-card-foreground border border-border"
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
