/// <reference path="../types/vite-worker.d.ts" />

import { useEffect, useState } from "react";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

interface MonacoWindow extends Window {
  MonacoEnvironment?: {
    getWorker: (_moduleId: string, _label: string) => Worker;
  };
}

type MonacoModule = typeof import("monaco-editor");

let monacoReadyPromise: Promise<MonacoModule> | null = null;

export const ensureMonacoReady = (): Promise<MonacoModule> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco requires a browser environment"));
  }
  if (monacoReadyPromise) {
    return monacoReadyPromise;
  }
  monacoReadyPromise = (async () => {
    const monacoWindow = window as MonacoWindow;
    if (!monacoWindow.MonacoEnvironment) {
      monacoWindow.MonacoEnvironment = {
        getWorker: function (_moduleId: string, _label: string) {
          return new editorWorker();
        },
      };
    }
    const monacoInstance: MonacoModule = await import("monaco-editor");
    loader.config({ monaco: monacoInstance });
    await loader.init();
    return monacoInstance;
  })();
  return monacoReadyPromise;
};

export const useMonacoReady = () => {
  const [status, setStatus] = useState<"pending" | "ready" | "failed">("pending");

  useEffect(() => {
    let cancelled = false;
    ensureMonacoReady()
      .then(() => {
        if (!cancelled) {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
};
