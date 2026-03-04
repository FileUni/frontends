import React from 'react';
import { MarkdownVditorEditor } from './MarkdownVditorEditor.tsx';
import { useConfigStore } from '@/stores/config.ts';

interface Props {
  path: string;
  isDark?: boolean;
  headerExtra?: React.ReactNode;
}

/**
 * 现代 Markdown/文本预览与编辑器 - Vditor 驱动 / Modern Markdown editor and previewer - Vditor powered
 */
export const MarkdownVditorPreview = ({ path, isDark, headerExtra }: Props) => {
  const { capabilities } = useConfigStore();
  const jsdelivrBase = capabilities?.jsdelivr_mirror_base || 'https://cdn.jsdelivr.net';

  return (
    <MarkdownVditorEditor
      path={path}
      isDark={isDark}
      headerExtra={headerExtra}
      cdnBase={jsdelivrBase}
    />
  );
};
