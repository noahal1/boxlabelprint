/** 字段定义 */
export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
  sort_order: number;
}

/** 箱牌类型 */
export type BoxType = 'inner' | 'outer';

export const BOX_TYPE_LABELS: Record<BoxType, string> = {
  inner: '内箱',
  outer: '外箱',
};

/** 箱牌标签 */
export interface BoxLabel {
  id: number;
  box_number: string;
  box_type: BoxType;
  custom_fields: Record<string, string>;
  qr_content: string;
  status: 'pending' | 'printed';
  print_count: number;
  created_at: string;
  printed_at: string | null;
}

/** 打印记录 */
export interface PrintLog {
  id: number;
  box_label_id: number;
  printer_name: string;
  printed_at: string;
  status: 'success' | 'failed';
}

/** 自动更新信息 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

/** 下载进度 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/** Electron API */
export interface ElectronAPI {
  // 数据库
  getBoxLabels: (filters?: { status?: string; keyword?: string }) => Promise<BoxLabel[]>;
  createBoxLabel: (data: { box_number: string; box_type: BoxType; custom_fields: Record<string, string>; qr_content?: string }) => Promise<{ id: number }>;
  updateBoxLabel: (id: number, data: Partial<BoxLabel>) => Promise<{ success: boolean }>;
  deleteBoxLabel: (id: number) => Promise<{ success: boolean }>;
  markPrinted: (id: number, printerName: string) => Promise<{ success: boolean }>;
  getPrintLogs: (boxLabelId?: number) => Promise<PrintLog[]>;
  generateBoxNumber: () => Promise<string>;

  // 字段定义
  getFieldDefinitions: (boxType?: BoxType) => Promise<FieldDefinition[]>;
  setFieldDefinitions: (boxType: BoxType, defs: FieldDefinition[]) => Promise<{ success: boolean }>;

  // 设置
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<{ success: boolean }>;
  getAllSettings: () => Promise<Record<string, string>>;

  // 窗口控制
  windowMinimize: () => Promise<{ success: boolean }>;
  windowMaximize: () => Promise<{ success: boolean }>;
  windowClose: () => Promise<{ success: boolean }>;
  windowIsMaximized: () => Promise<boolean>;

  // 打印
  printSend: (zplData: string) => Promise<{ success: boolean; error?: string; data?: string; message?: string; printerName?: string }>;
  printSystemPreview: (labelHtml: string) => Promise<{ success: boolean; error?: string }>;

  // 自动更新
  updateCheck: () => Promise<{ success: boolean; error?: string }>;
  updateDownload: () => Promise<{ success: boolean; error?: string }>;
  updateInstall: () => Promise<{ success: boolean; error?: string }>;
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (callback: (info?: UpdateInfo) => void) => () => void;
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError: (callback: (error: { message: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
