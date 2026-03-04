declare module 'docx-preview' {
  export function renderAsync(
    data: ArrayBuffer | Blob,
    body: HTMLElement,
    style?: string,
    options?: Record<string, unknown>
  ): Promise<void>;
}

declare module '@zenmrp/fortune-sheet-excel' {
  export function transformExcelToFortune(data: ArrayBuffer): Promise<Record<string, unknown>>;
}

declare module '@corbe30/fortune-excel' {
  export function transformFortuneToExcel(
    sheetRef: Record<string, unknown>,
    type?: string,
    autoDownload?: boolean
  ): Promise<Blob | ArrayBuffer | Uint8Array>;
}
