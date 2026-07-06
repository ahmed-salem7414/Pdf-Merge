import { PDFDocument } from 'pdf-lib';

/**
 * Reads a PDF file and returns its page count and encryption status.
 */
export async function getPdfPageCount(file: File): Promise<{ pageCount: number; isEncrypted: boolean }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Load without full parsing to keep it fast
    const pdfDoc = await PDFDocument.load(arrayBuffer, { 
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return {
      pageCount: pdfDoc.getPageCount(),
      isEncrypted: pdfDoc.isEncrypted,
    };
  } catch (err: any) {
    console.error('Error fetching page count:', err);
    throw new Error('تعذر قراءة عدد الصفحات. قد يكون الملف تالفًا.');
  }
}

/**
 * Merges an array of PDF files and executes a progress callback as it works through them.
 */
export async function mergePDFs(
  files: File[],
  onProgress: (percentage: number, message: string, currentStep: number, totalSteps: number) => void
): Promise<Uint8Array> {
  const totalFiles = files.length;
  onProgress(5, 'جاري تهيئة مستند PDF المدمج الجديد...', 0, totalFiles);
  
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const currentStepNum = i + 1;
    
    // Calculate percentage base for this file integration
    const startPercentage = 5 + (i / totalFiles) * 80;
    
    onProgress(
      Math.round(startPercentage),
      `جاري قراءة وتحميل الملف (${currentStepNum}/${totalFiles}): ${file.name}`,
      currentStepNum,
      totalFiles
    );
    
    try {
      const fileBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      
      // Flatten forms to prevent interactive widgets with broken references.
      // This is the primary fix for merged pages showing as blank or white.
      try {
        const form = pdf.getForm();
        if (form) {
          form.flatten();
        }
      } catch (formErr) {
        console.warn(`Form flattening skipped for ${file.name}:`, formErr);
      }
      
      onProgress(
        Math.round(startPercentage + (0.5 / totalFiles) * 80),
        `جاري ضم صفحات الملف: ${file.name}`,
        currentStepNum,
        totalFiles
      );
      
      const pageIndices = pdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
      
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    } catch (err: any) {
      console.error(`Error processing file ${file.name}:`, err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('encrypt')) {
        throw new Error(`فشل دمج الملف "${file.name}". الملف محمي بكلمة مرور أو مشفر، والأداة لا تدعم دمج الملفات المشفرة لحمايتها.`);
      }
      throw new Error(`فشل دمج الملف "${file.name}". قد يكون الملف تالفًا أو مشفرًا.`);
    }
  }
  
  onProgress(95, 'جاري تجميع الملفات وبناء المستند النهائي...', totalFiles, totalFiles);
  const mergedPdfBytes = await mergedPdf.save();
  onProgress(100, 'اكتمل دمج الملفات بنجاح!', totalFiles, totalFiles);
  
  return mergedPdfBytes;
}

/**
 * Helper to display file size in human-readable format.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
