import React, { useEffect, Suspense } from "react";
import type { EditorProps } from "@monaco-editor/react";
import { ensureMonacoReady, isMonacoSupported } from "../lib/monaco";

export type { EditorProps };

const LazyMonacoEditor = React.lazy(async () => {
  const mod = await import("@monaco-editor/react");
  return { default: mod.default };
});

export const MonacoEditor: React.FC<EditorProps> = (props) => {
  useEffect(() => {
    if (!isMonacoSupported()) {
      return;
    }
    ensureMonacoReady().catch((error) => {
      console.warn("Monaco initialization failed:", error);
    });
  }, []);

  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <LazyMonacoEditor {...props} />
    </Suspense>
  );
};
