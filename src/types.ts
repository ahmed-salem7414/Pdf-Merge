export interface PDFFile {
  id: string;
  name: string;
  size: number;
  pageCount: number | null;
  file: File;
  error?: string;
  loadingPageCount?: boolean;
  isEncrypted?: boolean;
}

export type MergeStatus = 'idle' | 'merging' | 'success' | 'error';

export interface MergeProgress {
  percentage: number;
  message: string;
  currentStep: number;
  totalSteps: number;
}

export type Language = 'ar' | 'en';
