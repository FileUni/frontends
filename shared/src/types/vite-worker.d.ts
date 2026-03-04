declare module '*?worker' {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const EditorWorkerFactory: {
    new (): Worker;
  };
  export default EditorWorkerFactory;
}
