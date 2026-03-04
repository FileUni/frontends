import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { renderAsync } from 'docx-preview';
import { Loader2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils.ts';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useThemeStore } from '@fileuni/shared';
import { useToastStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { blobToBase64, fetchFileArrayBuffer, fetchFileStatSize, getFileExtension, isComplexOfficeFile, resolveLimitBytes, uploadBase64File } from '../utils/officeLite.ts';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

interface Props {
  path: string;
  onClose: () => void;
}

type XmlElement = Element & { textContent: string | null };

function getElementsByLocalName(root: ParentNode, name: string): XmlElement[] {
  const all = Array.from(root.childNodes);
  const result: XmlElement[] = [];
  for (const node of all) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as XmlElement;
      if (element.localName === name) {
        result.push(element);
      }
      result.push(...getElementsByLocalName(element, name));
    }
  }
  return result;
}

function getParagraphElements(doc: Document): XmlElement[] {
  const direct = Array.from(doc.getElementsByTagName('w:p')) as XmlElement[];
  if (direct.length > 0) return direct;
  return getElementsByLocalName(doc, 'p');
}

function getTextElements(root: ParentNode): XmlElement[] {
  const direct = Array.from((root as Element).getElementsByTagName?.('w:t') || []) as XmlElement[];
  if (direct.length > 0) return direct;
  return getElementsByLocalName(root, 't');
}

function extractDocxText(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const paragraphs = getParagraphElements(doc);
  const texts = paragraphs.map((p) => getTextElements(p).map((t) => t.textContent || '').join(''));
  return texts.join('\n\n');
}

function applyTextToDocx(xml: string, content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const paragraphs = getParagraphElements(doc);
  const newParagraphs = content.split(/\n{2,}/).map((p) => p.replace(/\r/g, ''));

  const body = (doc.getElementsByTagName('w:body')[0] as XmlElement) || getElementsByLocalName(doc, 'body')[0];
  if (!body) {
    throw new Error('Document body not found');
  }

  const maxCount = Math.max(paragraphs.length, newParagraphs.length);
  for (let i = 0; i < maxCount; i += 1) {
    const paragraphText = newParagraphs[i] ?? '';
    let paragraph = paragraphs[i];

    if (!paragraph) {
      paragraph = doc.createElementNS(WORD_NS, 'w:p') as XmlElement;
      const run = doc.createElementNS(WORD_NS, 'w:r') as XmlElement;
      const textNode = doc.createElementNS(WORD_NS, 'w:t') as XmlElement;
      textNode.textContent = paragraphText;
      textNode.setAttribute('xml:space', 'preserve');
      run.appendChild(textNode);
      paragraph.appendChild(run);
      body.appendChild(paragraph);
      continue;
    }

    const textNodes = getTextElements(paragraph);
    if (textNodes.length === 0) {
      const run = doc.createElementNS(WORD_NS, 'w:r') as XmlElement;
      const textNode = doc.createElementNS(WORD_NS, 'w:t') as XmlElement;
      textNode.textContent = paragraphText;
      textNode.setAttribute('xml:space', 'preserve');
      run.appendChild(textNode);
      paragraph.appendChild(run);
      continue;
    }

    const originalLengths = textNodes.map((node) => (node.textContent ? node.textContent.length : 0));
    let remaining = paragraphText;
    for (let j = 0; j < textNodes.length; j += 1) {
      const isLast = j === textNodes.length - 1;
      const takeLength = isLast ? remaining.length : originalLengths[j] || 0;
      const segment = remaining.slice(0, takeLength);
      textNodes[j].textContent = segment;
      textNodes[j].setAttribute('xml:space', 'preserve');
      remaining = remaining.slice(segment.length);
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

export const DocxLiteEditor: React.FC<Props> = ({ path, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { capabilities } = useConfigStore();
  const { addToast } = useToastStore();
  const previewRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<JSZip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [editorText, setEditorText] = useState('');
  const [isComplex, setIsComplex] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const officeLimitBytes = resolveLimitBytes(capabilities?.preview_size_limits?.office_mb);
  const isLargeFile = fileSize > officeLimitBytes;

  const renderPreview = async (buffer: ArrayBuffer) => {
    if (!previewRef.current) return;
    previewRef.current.innerHTML = '';
    await renderAsync(buffer, previewRef.current, undefined, {
      inWrapper: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      useBase64URL: true
    });
  };

  const loadDocx = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const size = await fetchFileStatSize(path);
      setFileSize(size);
      if (size > officeLimitBytes && !forceOpen) {
        setLoading(false);
        return;
      }
      const buffer = await fetchFileArrayBuffer(path);
      const zip = await JSZip.loadAsync(buffer);
      const fileNames = Object.keys(zip.files);
      const ext = getFileExtension(path);
      const hasMedia = fileNames.some((name) => name.startsWith('word/media/'));
      const hasHeaderFooter = fileNames.some((name) => name.startsWith('word/header') || name.startsWith('word/footer'));
      const hasNotes = fileNames.some((name) => name.includes('footnotes.xml') || name.includes('endnotes.xml') || name.includes('comments.xml'));
      setIsComplex(isComplexOfficeFile(ext, size) || hasMedia || hasHeaderFooter || hasNotes);
      const xmlFile = zip.file('word/document.xml');
      if (!xmlFile) {
        throw new Error('Document body not found');
      }
      const xml = await xmlFile.async('string');
      setEditorText(extractDocxText(xml));
      zipRef.current = zip;
      await renderPreview(buffer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [path, forceOpen]);

  useEffect(() => {
    setForceOpen(false);
    setEditorText('');
    setIsComplex(false);
  }, [path]);

  useEffect(() => {
    loadDocx();
  }, [loadDocx]);

  const handleSave = async () => {
    if (!zipRef.current) return;
    setSaving(true);
    try {
      const xmlFile = zipRef.current.file('word/document.xml');
      if (!xmlFile) {
        throw new Error('Document body not found');
      }
      const xml = await xmlFile.async('string');
      const updatedXml = applyTextToDocx(xml, editorText);
      zipRef.current.file('word/document.xml', updatedXml);
      const updatedBytes = await zipRef.current.generateAsync({ type: 'uint8array' });
      const normalizedBytes = Uint8Array.from(updatedBytes);
      const blob = new Blob([normalizedBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const base64 = await blobToBase64(blob);
      await uploadBase64File(path, base64);
      await renderPreview(normalizedBytes.buffer as ArrayBuffer);
      addToast(t('filemanager.officeLite.saveSuccess'), 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : t('filemanager.officeLite.saveFailed');
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isLargeFile && !forceOpen) {
    return (
      <div className="fixed inset-0 z-[210] flex flex-col items-center justify-center bg-background text-center gap-4 px-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">
          {t('filemanager.officeLite.largeFileWarning', { size: Math.ceil(officeLimitBytes / (1024 * 1024)) })}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="primary" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={() => setForceOpen(true)}>
            {t('filemanager.officeLite.forceOpen')}
          </Button>
          <Button variant="outline" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-[210] flex flex-col", isDark ? "bg-background text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader
        path={path}
        subtitle={t('filemanager.officeLite.docxEditorTitle')}
        onClose={onClose}
        extra={
          <Button variant="primary" className="h-9 px-4 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? t('filemanager.officeLite.saving') : t('filemanager.officeLite.save')}
            <Save size={18} className="ml-2" />
          </Button>
        }
      />

      {isComplex && !loading && !error && (
        <div className={cn(
          "mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
          isDark ? "border-white/10 bg-white/5 text-white/70" : "border-zinc-200 bg-zinc-50 text-zinc-600"
        )}>
          {t('filemanager.officeLite.complexHint')}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
        <div className={cn("min-h-0 overflow-auto border-r", isDark ? "border-white/5" : "border-gray-200")}>
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin" size={28} />
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-60">
              {error}
            </div>
          )}
          {!loading && !error && <div ref={previewRef} className="docx-preview p-6" />}
        </div>
        <div className="min-h-0 flex flex-col">
          <div className={cn("px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] border-b", isDark ? "border-white/10 text-white/60" : "border-gray-200 text-gray-500")}>
            {t('filemanager.officeLite.docxHint')}
          </div>
          <textarea
            className={cn(
              "flex-1 resize-none bg-transparent px-4 py-3 text-sm font-mono outline-none",
              isDark ? "placeholder:text-white/20" : "placeholder:text-gray-400"
            )}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder={t('filemanager.officeLite.docxPlaceholder')}
            disabled={loading || !!error}
          />
        </div>
      </div>
    </div>
  );
};
