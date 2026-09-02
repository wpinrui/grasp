import { useEffect, useRef, useState } from "react";
import { apiNames } from "../sketch/script";
import "./ScriptDialog.css";

/** Which of the two buttons opened it: the asking, or the script on its own. */
export type ScriptWay = "ask" | "script";

/** Where the script is to work: a page GRASP will add, or one already there. */
export const NEW_PAGE = "new";

interface ScriptDialogProps {
  way: ScriptWay;
  /** What the user asked for, kept until the prompt built from it is copied. */
  request: string;
  onRequest: (request: string) => void;
  script: string;
  onScript: (script: string) => void;
  /** `NEW_PAGE`, or the id of the page being edited. */
  target: string;
  onTarget: (target: string) => void;
  pages: { id: string; name: string }[];
  /** The prompt to put on the clipboard, built when Next is pressed. */
  buildPrompt: () => string;
  /** The prompt reached the clipboard, so the request it was built from is spent. */
  onCopied: () => void;
  onRun: () => void;
  /** What went wrong with the last run. Empty when nothing has. */
  errors: string[];
  running: boolean;
  onClose: () => void;
}

/** The words JavaScript keeps for itself, coloured apart from the rest. */
const KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "false",
  "for",
  "function",
  "if",
  "in",
  "let",
  "new",
  "null",
  "of",
  "return",
  "switch",
  "throw",
  "true",
  "typeof",
  "undefined",
  "var",
  "while",
]);

function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The script coloured as the JavaScript it is: comments, strings and numbers,
 * the words the language keeps, and the calls GRASP provides. Written here
 * rather than pulled in, since the whole of it is one pass over the text.
 */
function highlight(source: string, calls: Set<string>): string {
  const token =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = "";
  let last = 0;
  for (const match of source.matchAll(token)) {
    const at = match.index ?? 0;
    out += escaped(source.slice(last, at));
    last = at + match[0].length;
    const [, comment, string, number, word] = match;
    if (comment) out += `<span class="js-comment">${escaped(comment)}</span>`;
    else if (string) out += `<span class="js-string">${escaped(string)}</span>`;
    else if (number) out += `<span class="js-number">${escaped(number)}</span>`;
    else if (word && KEYWORDS.has(word)) out += `<span class="js-keyword">${escaped(word)}</span>`;
    else if (word && calls.has(word)) out += `<span class="js-call">${escaped(word)}</span>`;
    else out += escaped(match[0]);
  }
  return `${out + escaped(source.slice(last))}\n`;
}

/**
 * The step-by-step way to a figure: say what you want, take the prompt away to
 * a language model, bring the script back.
 *
 * The AI button opens it at the first step; the Script button opens it at the
 * last, which is the box on its own.
 */
export function ScriptDialog({
  way,
  request,
  onRequest,
  script,
  onScript,
  target,
  onTarget,
  pages,
  buildPrompt,
  onCopied,
  onRun,
  errors,
  running,
  onClose,
}: ScriptDialogProps) {
  const [step, setStep] = useState(way === "script" ? 2 : 1);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  /** The prompt, kept so it can be read and copied again from the second step. */
  const [prompt, setPrompt] = useState("");
  const [showing, setShowing] = useState(false);
  const calls = useRef(new Set(apiNames()));
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Tab stays inside the card. Tabbing out of it puts the focus behind the
      // modal, where the keys do something else entirely.
      if (event.key !== "Tab" || !card.current) return;
      const stops = [
        ...card.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), textarea, select, [href]",
        ),
      ];
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const on = document.activeElement;
      if (!card.current.contains(on)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && on === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && on === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  /** Put the prompt on the clipboard, keeping it so it can go there again. */
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }

  async function copyPrompt() {
    const text = buildPrompt();
    setPrompt(text);
    await copy(text);
    onCopied();
    setStep(2);
  }

  const chooser = (
    <label className="script__target">
      Draw on
      <select value={target} onChange={(event) => onTarget(event.target.value)}>
        <option value={NEW_PAGE}>A new page</option>
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            Edit {page.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    // A press outside the card does not shut it. There is typed work in here,
    // and a modal that goes away on a stray click takes that work off the
    // screen. The close button and Escape are the ways out.
    <div className="script__scrim">
      <div className="script" ref={card}>
        <div className="script__bar">
          <span className="script__title">{way === "ask" ? "Ask an AI" : "Run a script"}</span>
          <span className="script__steps">{way === "ask" ? `Step ${step} of 2` : ""}</span>
          <button type="button" className="script__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {step === 1 && (
          <div className="script__body">
            <p className="script__say">What do you want drawn?</p>
            <textarea
              className="script__request"
              // biome-ignore lint/a11y/noAutofocus: the button was pressed to type here
              autoFocus
              value={request}
              placeholder="a visual proof that the two tangents from a point outside a circle are equal"
              onChange={(event) => onRequest(event.target.value)}
            />
            {chooser}
            <div className="script__row">
              <button
                type="button"
                className="script__key script__key--on"
                disabled={request.trim().length === 0}
                onClick={copyPrompt}
              >
                Copy instructions
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="script__body">
            {way === "ask" && (
              <div className="script__handoff">
                <p className={`script__say script__say--${copied === "yes" ? "done" : "failed"}`}>
                  {copied === "yes"
                    ? "✓ Instructions for the AI are on your clipboard."
                    : "✕ The instructions could not be copied. Press Copy again."}
                </p>
                <p className="script__note">
                  Paste them into any AI chat: ChatGPT, Claude, Gemini, whichever you use. It will
                  ask you about anything it is unsure of, then answer with a script. Paste that
                  script below.
                </p>
                <div className="script__row script__row--left">
                  <button type="button" className="script__link" onClick={() => void copy(prompt)}>
                    Copy again
                  </button>
                  <button
                    type="button"
                    className="script__link"
                    onClick={() => setShowing((was) => !was)}
                  >
                    {showing ? "Hide the instructions" : "Show me the instructions"}
                  </button>
                </div>
                {showing && <pre className="script__prompt">{prompt}</pre>}
              </div>
            )}
            <p className="script__say">
              {way === "ask" ? "The script the AI wrote" : "Paste the script."}
            </p>
            <div className="script__code">
              <pre
                className="script__paint"
                aria-hidden="true"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: the colours are spans this file wrote round text it escaped
                dangerouslySetInnerHTML={{ __html: highlight(script, calls.current) }}
              />
              <textarea
                className="script__type"
                // biome-ignore lint/a11y/noAutofocus: the button was pressed to type here
                autoFocus
                spellCheck={false}
                value={script}
                placeholder={"const O = point(0, 0)\nconst R = point(180, 0)\ncircle(O, R)"}
                onChange={(event) => onScript(event.target.value)}
                onScroll={(event) => {
                  const paint = event.currentTarget.previousElementSibling as HTMLElement | null;
                  if (paint) paint.scrollTop = event.currentTarget.scrollTop;
                }}
              />
            </div>
            {errors.length > 0 && (
              <ul className="script__errors">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {chooser}
            <div className="script__row">
              {way === "ask" && (
                <button type="button" className="script__key" onClick={() => setStep(1)}>
                  Back
                </button>
              )}
              <button
                type="button"
                className="script__key script__key--on"
                disabled={script.trim().length === 0 || running}
                onClick={onRun}
              >
                {running ? "Running..." : "Run"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
