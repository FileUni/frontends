import React, { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

/**
 * Configuration note entry interface
 */
export interface ConfigNoteEntry {
  desc_en: string;
  desc_zh: string;
  example: string;
}

/**
 * Configuration error interface
 */
export interface ConfigError {
  line: number;
  column: number;
  message: string;
  key?: string | null;
}

interface ConfigRawEditorProps {
  content: string;
  onChange: (value: string) => void;
  embeddedTemplate?: string;
  notes: Record<string, ConfigNoteEntry>;
  errors?: ConfigError[];
  height?: string;
  activePath?: string;
  hideNotes?: boolean;
  isDark?: boolean;
}

interface MonacoWindow extends Window {
  MonacoEnvironment?: {
    getWorker: (_moduleId: string, _label: string) => Worker;
  };
}

type MonacoModule = typeof import("monaco-editor");

/**
 * Robust line number lookup
 */
const findLineByPath = (content: string, path: string): number => {
  if (!path) return 1;
  const lines = content.split(/\r?\n/);
  const parts = path.split(".");
  const key = parts.pop() || "";
  const sectionName = parts.join(".");

  let startLine = 0;
  let endLine = lines.length;

  if (sectionName) {
    const sectionTarget = `[${sectionName}]`;
    const sectionTargetArray = `[[${sectionName}]]`;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = (lines[i] ?? '').trim();
      if (trimmed === sectionTarget || trimmed === sectionTargetArray) {
        startLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          if ((lines[j] ?? '').trim().startsWith("[")) {
            endLine = j;
            break;
          }
        }
        break;
      }
    }
  }

  const keyRegex = new RegExp(`^\\s*${key}\\s*=`);
  for (let i = startLine; i < endLine; i++) {
    if (keyRegex.test(lines[i] ?? '')) {
      return i + 1;
    }
  }

  return startLine > 0 ? startLine + 1 : 1;
};

const resolveActivePath = (content: string, lineNumber: number): string => {
  const lines = content.split(/\r?\n/);
  if (lineNumber <= 0 || lineNumber > lines.length) return "";

  let currentSection = "";
  for (let i = lineNumber - 1; i >= 0; i--) {
    const line = (lines[i] || "").trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.replace(/[\[\]]/g, "");
      break;
    }
  }

  const currentLine = (lines[lineNumber - 1] || "").trim();
  const match = currentLine.match(/^([a-zA-Z0-9_-]+)\s*=/);
  if (match && match[1]) {
    return currentSection ? `${currentSection}.${match[1]}` : match[1];
  }

  return currentSection;
};

const getLocalizedNote = (note: ConfigNoteEntry, lang: string) => {
  const isEn = lang.startsWith("en");
  return {
    title: isEn ? "Configuration Detail" : "配置详情",
    description: isEn ? note.desc_en : note.desc_zh,
  };
};

const registerTomlLanguage = (monacoInstance: MonacoModule) => {
  const languageId = "toml-config";
  const existing = monacoInstance.languages
    .getLanguages()
    .some((lang: { id: string }) => lang.id === languageId);

  if (!existing) {
    monacoInstance.languages.register({ id: languageId });
  }

  monacoInstance.languages.setMonarchTokensProvider(languageId, {
    tokenizer: {
      root: [
        [/^\s*\[[^\]]+\]\s*$/, "type.identifier"],
        [/^\s*\[\[[^\]]+\]\]\s*$/, "type.identifier"],
        [/^\s*[A-Za-z0-9_.-]+\s*(?==)/, "key"],
        [/=\s*/, "delimiter"],
        [/#.*$/, "comment"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/'(?:[^'\\]|\\.)*'/, "string"],
        [/\b(true|false)\b/, "keyword"],
        [/\b[+-]?\d+\.\d+([eE][+-]?\d+)?\b/, "number.float"],
        [/\b[+-]?\d+\b/, "number"],
        [/\b\d{4}-\d{2}-\d{2}([Tt ][0-9:.+-Zz]+)?\b/, "number"],
        [/[{},\[\]]/, "delimiter.bracket"],
      ],
    },
  });

  return languageId;
};

/**
 * Unified Configuration Raw Editor
 */
export const ConfigRawEditor: React.FC<ConfigRawEditorProps> = ({
  content,
  onChange,
  embeddedTemplate,
  notes,
  height = "600px",
  activePath: externalActivePath,
  hideNotes = false,
  isDark = true,
}) => {
  const { t, i18n } = useTranslation();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoModule | null>(null);
  const [internalActivePath, setInternalActivePath] = useState("");
  const decorationCollectionRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const [monacoStatus, setMonacoStatus] = useState<"pending" | "ready" | "failed">("pending");
  const [useFallbackEditor, setUseFallbackEditor] = useState(false);
  const resolvedHeight = height === "100%" ? "clamp(360px, 62vh, 900px)" : height;

  const activePath = externalActivePath || internalActivePath;

  useEffect(() => {
    let cancelled = false;

    // Configure local Monaco runtime in component lifecycle.
    const setupMonaco = async () => {
      if (typeof window === "undefined") return;
      try {
        const monacoWindow = window as MonacoWindow;
        monacoWindow.MonacoEnvironment = {
          getWorker: function (_moduleId: string, _label: string) {
            return new editorWorker();
          },
        };
        const monacoInstance: MonacoModule = await import("monaco-editor");
        if (!cancelled) {
          loader.config({ monaco: monacoInstance });
          await loader.init();
          if (!cancelled) {
            setMonacoStatus("ready");
            setUseFallbackEditor(false);
          }
        }
      } catch (error: unknown) {
        console.error("Failed to initialize Monaco loader:", error);
        if (!cancelled) {
          setMonacoStatus("failed");
          setUseFallbackEditor(true);
        }
      }
    };

    void setupMonaco();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeNote = useMemo(() => {
    if (!activePath) return null;
    if (notes[activePath]) return notes[activePath];
    const parts = activePath.split(".");
    while (parts.length > 1) {
      parts.pop();
      const key = parts.join(".");
      if (notes[key]) return notes[key];
    }
    return null;
  }, [activePath, notes]);

  useEffect(() => {
    if (!externalActivePath || !editorRef.current) return undefined;

    const editor = editorRef.current;
    const line = findLineByPath(content, externalActivePath);

    if (line > 0) {
      editor.revealLineInCenter(line, 0);

      const model = editor.getModel();
      if (model) {
        editor.setSelection({
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        });

        if (decorationCollectionRef.current) {
          decorationCollectionRef.current.clear();
        }

        decorationCollectionRef.current = editor.createDecorationsCollection([
          {
            range: {
              startLineNumber: line,
              startColumn: 1,
              endLineNumber: line,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: "bg-primary/20",
              marginClassName: "bg-primary/40",
            },
          },
        ]);

        const timer = setTimeout(() => {
          decorationCollectionRef.current?.clear();
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [externalActivePath, content]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setUseFallbackEditor(false);
    const languageId = registerTomlLanguage(monaco);
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, languageId);
    }

    setTimeout(() => {
      editor.layout();
    }, 100);

    editor.onDidChangeCursorPosition((evt) => {
      const value = editor.getValue();
      const path = resolveActivePath(value, evt.position.lineNumber);
      setInternalActivePath(path);
    });
  };

  return (
    <div className="flex flex-col w-full gap-3 sm:gap-4" style={{ height: resolvedHeight, minHeight: "360px" }}>
      <div className="flex flex-col shrink-0 gap-3 sm:gap-4">
        {!hideNotes && (
          <div className={cn(
            "rounded-xl sm:rounded-2xl border p-3 sm:p-4 flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-top-2 shadow-sm",
            isDark 
              ? "border-white/5 bg-white/[0.02]" 
              : "border-slate-200 bg-slate-50"
          )}>
            {activeNote ? (
              (() => {
                const localized = getLocalizedNote(activeNote, i18n.language);
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="text-sm sm:text-sm font-black uppercase text-primary leading-none mb-1">
                        {localized.title}
                      </div>
                      <div className={cn(
                        "text-sm sm:text-sm leading-relaxed break-words whitespace-normal font-bold",
                        isDark ? "text-white/90" : "text-slate-800"
                      )}>
                        {localized.description}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                      {activeNote.example !== "{SECTION}" && activeNote.example !== "" && (
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg border shrink-0",
                          isDark 
                            ? "bg-black/40 border-white/5" 
                            : "bg-white border-slate-200"
                        )}>
                          <span className={cn(
                            "text-sm uppercase font-black whitespace-nowrap",
                            isDark ? "opacity-40" : "text-slate-500"
                          )}>
                            {t("admin.config.example")}
                          </span>
                          <code className={cn(
                            "text-sm font-mono break-all font-bold",
                            isDark ? "text-emerald-400" : "text-emerald-700"
                          )}>
                            {activeNote.example}
                          </code>
                        </div>
                      )}
                      {activePath && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-sm uppercase font-black",
                            isDark ? "opacity-30" : "text-slate-400"
                          )}>Path</span>
                          <code className={cn(
                            "text-sm sm:text-sm font-mono break-all font-bold",
                            isDark ? "opacity-60" : "text-slate-500"
                          )}>
                            {activePath}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                <div className={cn(
                  "text-sm sm:text-sm font-bold italic",
                  isDark ? "opacity-30" : "text-slate-400"
                )}>
                  {t("admin.config.noteEmpty")}
                </div>
                {activePath && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-sm uppercase font-black",
                      isDark ? "opacity-30" : "text-slate-400"
                    )}>Path</span>
                    <code className={cn(
                      "text-sm sm:text-sm font-mono break-all font-bold",
                      isDark ? "opacity-60" : "text-slate-500"
                    )}>
                      {activePath}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {embeddedTemplate && (
          <div className="flex justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 border-dashed text-sm font-black uppercase px-3"
              onClick={() => onChange(embeddedTemplate)}
            >
              <AlertTriangle size={18} className="mr-2" />
              {t("admin.config.reset")}
            </Button>
          </div>
        )}
      </div>

      <div className={cn(
        "flex-1 h-full rounded-xl sm:rounded-2xl lg:rounded-[2.5rem] border overflow-hidden shadow-2xl relative min-h-[320px] transition-colors",
        isDark 
          ? "bg-[#1e1e1e] border-white/10" 
          : "bg-white border-slate-300"
      )}>
        {useFallbackEditor ? (
          <textarea
            className={cn(
              "h-full w-full resize-none p-4 font-mono text-sm leading-6 outline-none",
              isDark ? "bg-[#1e1e1e] text-[#d4d4d4]" : "bg-white text-slate-900"
            )}
            spellCheck={false}
            value={content}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : monacoStatus !== "ready" ? (
          <div className={cn(
            "h-full w-full flex items-center justify-center text-lg font-black",
            isDark ? "text-slate-300" : "text-slate-600"
          )}>
            {t("admin.config.loading")}
          </div>
        ) : (
          <Editor
            height="100%"
            width="100%"
            language="toml-config"
            theme={isDark ? "vs-dark" : "vs"}
            value={content}
            onChange={(v) => {
              if (typeof v === "string") {
                onChange(v);
              }
            }}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 14,
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              renderLineHighlight: "all",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        )}
      </div>
    </div>
  );
};
