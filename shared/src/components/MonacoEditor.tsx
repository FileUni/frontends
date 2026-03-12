import React, { useEffect } from "react";
import Editor, { type EditorProps } from "@monaco-editor/react";
import { ensureMonacoReady } from "../lib/monaco";

export type { EditorProps };

export const MonacoEditor: React.FC<EditorProps> = (props) => {
  useEffect(() => {
    void ensureMonacoReady();
  }, []);

  return <Editor {...props} />;
};
