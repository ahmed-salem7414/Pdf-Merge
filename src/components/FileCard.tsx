import { motion } from 'motion/react';
import { 
  FileText, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import { PDFFile } from '../types';
import { formatBytes } from '../pdfUtils';

interface FileCardProps {
  key?: string;
  pdfFile: PDFFile;
  index: number;
  totalFiles: number;
  lang: 'ar' | 'en';
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FileCard({ 
  pdfFile, 
  index, 
  totalFiles, 
  lang,
  onMoveUp, 
  onMoveDown, 
  onDelete 
}: FileCardProps) {
  const isAr = lang === 'ar';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-[#e2e8f0] rounded-2xl hover:border-blue-200 shadow-sm transition-all duration-200"
      id={`file-card-${pdfFile.id}`}
    >
      {/* Index Badge */}
      <div className={`absolute -top-2.5 ${isAr ? '-right-2.5' : '-left-2.5'} w-6 h-6 rounded-full bg-[#2563eb] text-white text-[11px] font-mono flex items-center justify-center font-bold shadow`}>
        {index + 1}
      </div>

      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0 pr-2">
        <div className="p-3 bg-red-50 text-red-500 rounded-xl group-hover:bg-[#2563eb] group-hover:text-white transition-colors duration-200 shrink-0">
          <FileText className="w-5 h-5" id={`pdf-icon-${pdfFile.id}`} />
        </div>
        
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0f172a] truncate mb-1" id={`file-name-${pdfFile.id}`}>
            {pdfFile.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b]">
            <span className="font-mono">{formatBytes(pdfFile.size)}</span>
            <span className="text-slate-300">•</span>
            {pdfFile.loadingPageCount ? (
              <span className="flex items-center gap-1 text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isAr ? 'جاري التحقق من الصفحات...' : 'Reading pages...'}
              </span>
            ) : pdfFile.error ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {pdfFile.error}
              </span>
            ) : (
              <span className="font-medium bg-[#f1f5f9] px-2 py-0.5 rounded text-[#475569]">
                {pdfFile.pageCount} {pdfFile.pageCount === 1 ? (isAr ? 'صفحة' : 'page') : (isAr ? 'صفحات' : 'pages')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-end gap-1.5 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#f1f5f9] shrink-0">
        <div className="flex items-center bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-0.5" id={`ordering-controls-${pdfFile.id}`}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveUp(pdfFile.id)}
            title={isAr ? 'تحريك لأعلى' : 'Move Up'}
            className="p-1.5 rounded-md text-[#64748b] hover:bg-white hover:text-[#2563eb] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#64748b] transition-all cursor-pointer"
            id={`btn-up-${pdfFile.id}`}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            disabled={index === totalFiles - 1}
            onClick={() => onMoveDown(pdfFile.id)}
            title={isAr ? 'تحريك لأسفل' : 'Move Down'}
            className="p-1.5 rounded-md text-[#64748b] hover:bg-white hover:text-[#2563eb] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#64748b] transition-all cursor-pointer"
            id={`btn-down-${pdfFile.id}`}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onDelete(pdfFile.id)}
          title={isAr ? 'حذف الملف' : 'Remove File'}
          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-200 rounded-lg cursor-pointer"
          id={`btn-delete-${pdfFile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
