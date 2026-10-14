"use client";

import { useRef, useState } from "react";
import { montserrat } from "@/lib/fonts";

const COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Cyan", value: "#00b4d8" },
  { label: "Black", value: "#000000" },
  { label: "Red", value: "#dc2626" },
  { label: "Green", value: "#16a34a" },
];

// Block-level tags line spacing is applied to. DIV is included because
// Chrome's contentEditable wraps a bare typed line in a <div>, not <p>,
// before the user ever presses Enter.
const BLOCK_TAGS = ["P", "H1", "H2", "H3", "LI", "DIV", "BLOCKQUOTE"];

function closestBlock(node: Node | null, root: HTMLElement | null): HTMLElement | null {
  let el = node ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)) : null;
  while (el && el !== root && !BLOCK_TAGS.includes(el.tagName)) {
    el = el.parentElement;
  }
  return el;
}

/** WYSIWYG editor backed by a hidden input so it drops into a normal
 *  <form action={...}> the same way a text Field does — no client-side
 *  state wiring needed by the caller. Stores/emits raw HTML; the content
 *  is dangerouslySetInnerHTML'd back out on the customer-facing page. */
export function RichTextEditor({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  errors?: string[];
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");

  const syncHidden = () => {
    if (editorRef.current && hiddenRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  };

  const syncHiddenFromTextarea = () => {
    if (textareaRef.current && hiddenRef.current) {
      hiddenRef.current.value = textareaRef.current.value;
    }
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncHidden();
  };

  const toggleHtmlView = () => {
    if (mode === "wysiwyg") {
      // Sync explicitly rather than relying on the div's onBlur — hiding a
      // focused element during a React commit does fire a native blur, but
      // React's own synthetic onBlur handler doesn't reliably see it since
      // it's a side effect of the commit that's still in progress.
      const html = editorRef.current?.innerHTML ?? "";
      if (textareaRef.current) textareaRef.current.value = html;
      if (hiddenRef.current) hiddenRef.current.value = html;
      setMode("html");
    } else {
      const html = textareaRef.current?.value ?? "";
      if (editorRef.current) editorRef.current.innerHTML = html;
      if (hiddenRef.current) hiddenRef.current.value = html;
      setMode("wysiwyg");
    }
  };

  // execCommand("fontSize", ...) only offers 7 coarse legacy levels — instead
  // wrap the selection in a span with an explicit px size computed off its
  // current rendered size, so each click nudges it up/down predictably.
  const changeFontSize = (delta: number) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);

    // Nearest element of ANY kind (not just block tags) — reads the size of
    // an existing font-size span so repeated clicks accumulate instead of
    // resetting to the block's base size every time.
    const startNode = range.startContainer;
    const startEl =
      (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode as HTMLElement)) ??
      editorRef.current;
    const baseSize = startEl ? parseFloat(window.getComputedStyle(startEl).fontSize) : 16;
    const nextSize = Math.max(8, Math.min(96, Math.round((Number.isFinite(baseSize) ? baseSize : 16) + delta)));

    const span = document.createElement("span");
    span.style.fontSize = `${nextSize}px`;
    try {
      range.surroundContents(span);
    } catch {
      // Selection crosses element boundaries (e.g. spans two paragraphs) —
      // surroundContents can't wrap that in place, so extract + re-wrap instead.
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    syncHidden();
  };

  // Line-height is a block-level property — apply it to every block element
  // the selection touches (falling back to the enclosing block, or the editor
  // root itself for content with no block wrapper yet).
  const changeLineSpacing = (delta: number) => {
    editorRef.current?.focus();
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const blocks = new Set<HTMLElement>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        BLOCK_TAGS.includes((node as Element).tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (range.intersectsNode(node)) blocks.add(node as HTMLElement);
    }
    if (blocks.size === 0) {
      blocks.add(closestBlock(range.startContainer, root) ?? root);
    }

    blocks.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const currentPx = parseFloat(computed.lineHeight);
      const fontSize = parseFloat(computed.fontSize);
      const currentEm = currentPx && fontSize ? currentPx / fontSize : 1.4;
      const next = Math.max(1, Math.min(3, +(currentEm + delta).toFixed(2)));
      el.style.lineHeight = String(next);
    });

    syncHidden();
  };

  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">{label}</label>

      <div className="rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-50 p-1.5 dark:border-zinc-700 dark:bg-zinc-800/60">
        <div className="flex flex-wrap items-center gap-1">
          {mode === "wysiwyg" && (
            <>
              <ToolbarButton label="Bold" onClick={() => exec("bold")}>
                <span className="font-bold">B</span>
              </ToolbarButton>
              <ToolbarButton label="Italic" onClick={() => exec("italic")}>
                <span className="italic">I</span>
              </ToolbarButton>
              <ToolbarButton label="Strikethrough" onClick={() => exec("strikeThrough")}>
                <span className="line-through">S</span>
              </ToolbarButton>
              <ToolbarButton label="Underline" onClick={() => exec("underline")}>
                <span className="underline">U</span>
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Decrease font size" onClick={() => changeFontSize(-2)}>
                A−
              </ToolbarButton>
              <ToolbarButton label="Increase font size" onClick={() => changeFontSize(2)}>
                A+
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Big heading" onClick={() => exec("formatBlock", "H1")}>
                H1
              </ToolbarButton>
              <ToolbarButton label="Small heading" onClick={() => exec("formatBlock", "H2")}>
                H2
              </ToolbarButton>
              <ToolbarButton label="Normal text" onClick={() => exec("formatBlock", "P")}>
                P
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Bullet list" onClick={() => exec("insertUnorderedList")}>
                •≡
              </ToolbarButton>
              <ToolbarButton label="Numbered list" onClick={() => exec("insertOrderedList")}>
                1.≡
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Align left" onClick={() => exec("justifyLeft")}>
                ⇤
              </ToolbarButton>
              <ToolbarButton label="Align center" onClick={() => exec("justifyCenter")}>
                ⇔
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Decrease line spacing" onClick={() => changeLineSpacing(-0.25)}>
                ↕−
              </ToolbarButton>
              <ToolbarButton label="Increase line spacing" onClick={() => changeLineSpacing(0.25)}>
                ↕+
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec("foreColor", c.value)}
                  className="h-6 w-6 rounded-full border border-zinc-300 dark:border-zinc-600"
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <label
                title="Custom color"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-400 text-[10px] text-zinc-500 dark:border-zinc-500 dark:text-zinc-400"
              >
                +
                <input type="color" className="hidden" onChange={(e) => exec("foreColor", e.target.value)} />
              </label>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />

              <ToolbarButton label="Clear formatting" onClick={() => exec("removeFormat")}>
                Clear
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-600" />
            </>
          )}

          <ToolbarButton
            label={mode === "wysiwyg" ? "View/edit raw HTML" : "Back to rich text editor"}
            onClick={toggleHtmlView}
          >
            {mode === "wysiwyg" ? "</>" : "Rich text"}
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHidden}
        onBlur={syncHidden}
        dangerouslySetInnerHTML={{ __html: defaultValue ?? "" }}
        hidden={mode === "html"}
        className={`${montserrat.className} min-h-[140px] rounded-b-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5`}
      />
      <textarea
        ref={textareaRef}
        hidden={mode === "wysiwyg"}
        onInput={syncHiddenFromTextarea}
        defaultValue={defaultValue ?? ""}
        spellCheck={false}
        className="min-h-[140px] w-full resize-y rounded-b-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      />

      {/* type="text" (visually hidden), not type="hidden": a hidden-type
          input's `.value` IDL attribute is spec'd to mirror `defaultValue`
          directly, so React's per-commit input reconciliation resets our
          imperative `.value` writes back to the original defaultValue on
          every unrelated re-render of this component (e.g. toggling HTML
          view). A text input keeps `.value` independent once set. */}
      <input ref={hiddenRef} type="text" name={name} defaultValue={defaultValue ?? ""} hidden />
      {errors?.[0] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[0]}</p>}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      // Prevent the editor from losing focus/selection before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="min-w-[28px] rounded px-1.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {children}
    </button>
  );
}
