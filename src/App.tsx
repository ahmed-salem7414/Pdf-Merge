import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  Files, 
  Combine, 
  Sparkles, 
  FolderDown, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRightLeft, 
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  HelpCircle
} from 'lucide-react';
import { translations } from './localization';
import { PDFFile, MergeProgress, MergeStatus, Language } from './types';
import { getPdfPageCount, mergePDFs, formatBytes } from './pdfUtils';
import { FileCard } from './components/FileCard';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>('idle');
  const [progress, setProgress] = useState<MergeProgress>({ 
    percentage: 0, 
    message: '', 
    currentStep: 0, 
    totalSteps: 0 
  });
  const [outputName, setOutputName] = useState<string>('');
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'error', text: string } | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);

  const t = translations[lang];
  const isAr = lang === 'ar';

  // Toggle Language
  const toggleLanguage = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar');
  };

  // Clear system-wide notification after timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Clean object URL on unmount or refresh
  useEffect(() => {
    return () => {
      if (mergedBlobUrl) {
        URL.revokeObjectURL(mergedBlobUrl);
      }
    };
  }, [mergedBlobUrl]);

  // Read added files and fetch page numbers asynchronously
  const processUploadedFiles = async (selectedFiles: FileList | File[]) => {
    const rawList = Array.from(selectedFiles);
    const pdfs = rawList.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length < rawList.length) {
      setNotification({
        type: 'warning',
        text: t.invalidFileType
      });
    }

    if (pdfs.length === 0) return;

    const newFileEntries: PDFFile[] = pdfs.map(file => ({
      id: `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      pageCount: null,
      file,
      loadingPageCount: true
    }));

    setFiles(prev => [...prev, ...newFileEntries]);
    setErrorMsg(null);

    setNotification({
      type: 'success',
      text: isAr ? `تم إضافة ${newFileEntries.length} ملف(ات) بنجاح.` : `Successfully added ${newFileEntries.length} file(s).`
    });

    // Asynchronously resolve page counts to keep UX super fluent
    for (const entry of newFileEntries) {
      try {
        const count = await getPdfPageCount(entry.file);
        setFiles(prev => prev.map(item => 
          item.id === entry.id 
            ? { ...item, pageCount: count, loadingPageCount: false } 
            : item
        ));
      } catch (err: any) {
        setFiles(prev => prev.map(item => 
          item.id === entry.id 
            ? { ...item, loadingPageCount: false, error: isAr ? 'تعذر قراءة الصفحات' : 'Unreadable' } 
            : item
        ));
      }
    }
  };

  // Drag Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  // Click handler to open dialog
  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(e.target.files);
      e.target.value = ''; // Reset input so same file can be uploaded again
    }
  };

  // Arrow Ordering Operations
  const handleMoveUp = (id: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx <= 0) return prev;
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      return updated;
    });
  };

  const handleMoveDown = (id: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      return updated;
    });
  };

  // Delete Action
  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
    setErrorMsg(null);
  };

  // Perform PDF Merge Client-Side
  const handleMergePDFFiles = async () => {
    if (files.length < 2) {
      setErrorMsg(t.errorNoFiles);
      return;
    }

    setMergeStatus('merging');
    setErrorMsg(null);
    setIsPreviewExpanded(false);

    // Initial dummy steps
    setProgress({ 
      percentage: 0, 
      message: isAr ? 'جاري التحضير وتهيئة دمج المستندات...' : 'Preparing files...', 
      currentStep: 0, 
      totalSteps: files.length 
    });

    try {
      const rawFilesOnly = files.map(f => f.file);
      const mergedBytes = await mergePDFs(rawFilesOnly, (pct, msg, stepNum, total) => {
        setProgress({
          percentage: pct,
          message: msg,
          currentStep: stepNum,
          totalSteps: total
        });
      });

      const finalBlob = new Blob([mergedBytes], { type: 'application/pdf' });
      const finalUrl = URL.createObjectURL(finalBlob);

      setMergedBlob(finalBlob);
      setMergedBlobUrl(finalUrl);
      setMergeStatus('success');

      setNotification({
        type: 'success',
        text: isAr ? 'اكتمل دمج ملفاتك بنجاح!' : 'Files merged successfully!'
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || t.errorMergeFailed);
      setMergeStatus('error');
    }
  };

  // Download Action
  const triggerDownload = () => {
    if (!mergedBlobUrl) return;
    
    const formattedName = outputName.trim()
      ? outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`
      : isAr ? `${t.filePlaceholder}.pdf` : `${t.filePlaceholder}.pdf`;

    const link = document.createElement('a');
    link.href = mergedBlobUrl;
    link.download = formattedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset to original upload view
  const handleResetMerge = () => {
    setMergeStatus('idle');
    setMergedBlob(null);
    if (mergedBlobUrl) {
      URL.revokeObjectURL(mergedBlobUrl);
      setMergedBlobUrl(null);
    }
    setProgress({ percentage: 0, message: '', currentStep: 0, totalSteps: 0 });
    setIsPreviewExpanded(false);
  };

  // Calculate Aggregates
  const totalFilesCount = files.length;
  const totalCombinedSize = files.reduce((acc, curr) => acc + curr.size, 0);
  const totalPagesSum = files.reduce((acc, curr) => acc + (curr.pageCount || 0), 0);
  const resolvingPages = files.some(f => f.loadingPageCount);

  return (
    <div 
      className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] transition-colors duration-200 selection:bg-blue-100 selection:text-blue-900"
      dir={isAr ? 'rtl' : 'ltr'}
      id="app-container"
    >
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e2e8f0]" id="app-header">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563eb] rounded-lg flex items-center justify-center text-white shadow-sm">
              <Combine className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                {isAr ? 'PDF دمج' : 'PDF Merger'}
              </h1>
              <p className="hidden xs:block text-[10px] font-mono text-[#94a3b8] mt-0.5 tracking-wider uppercase">
                Private In-Browser Sandbox
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex gap-6 text-sm font-medium text-[#64748b]">
              <span className="text-[#2563eb] border-b-2 border-[#2563eb] pb-0.5 cursor-default">{isAr ? 'الرئيسية' : 'Home'}</span>
              <span className="opacity-60 cursor-not-allowed text-xs self-center px-1.5 py-0.5 bg-slate-50 rounded">{isAr ? 'صيغة محلية' : 'Sandbox Edition'}</span>
            </nav>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#475569] text-xs sm:text-sm font-semibold rounded-lg transition-all border border-[#e2e8f0] cursor-pointer"
              id="btn-lang-toggle"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-12 relative z-10" id="main-content">
        
        {/* Floating Notification Alerts */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-20 ${isAr ? 'left-6' : 'right-6'} z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-md ${
                notification.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : notification.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
              id="floating-notification"
            >
              <div className="shrink-0">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium">{notification.text}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12" id="hero-heading">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#2563eb] rounded-full text-xs font-semibold mb-4 border border-blue-100"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'أمن وحماية 100٪ داخل جهازك' : '100% Secure Local Sandbox'}</span>
          </motion.div>
          
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0f172a] tracking-tight mb-4 leading-tight">
            {t.title}
          </h2>
          <p className="text-[#64748b] text-base leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* Merge Flow Views (Switching states dynamically) */}
        <div>
          {mergeStatus === 'idle' || mergeStatus === 'error' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="idle-workspace">
              
              {/* Left Column (Options/Metadata Setup) */}
              <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit gap-6 flex flex-col" id="setup-sidebar">
                
                {/* Stats Dashboard */}
                <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6" id="statistics-card">
                  <h3 className="text-sm font-bold text-[#0f172a] border-b border-[#f1f5f9] pb-3 mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#2563eb]" />
                    {isAr ? 'ملخص مستنداتك حالياً' : 'Current Workspace Summary'}
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#f8fafc] rounded-xl p-3 text-center border border-[#f1f5f9]">
                      <p className="text-[10px] uppercase font-semibold tracking-wider text-[#94a3b8] mb-1">
                        {isAr ? 'الملفات' : 'Files'}
                      </p>
                      <p className="text-xl font-bold font-mono text-[#0f172a]" id="stat-files-count">
                        {totalFilesCount}
                      </p>
                    </div>
                    
                    <div className="bg-[#f8fafc] rounded-xl p-3 text-center border border-[#f1f5f9]">
                      <p className="text-[10px] uppercase font-semibold tracking-wider text-[#94a3b8] mb-1">
                        {isAr ? 'الصفحات' : 'Pages'}
                      </p>
                      <p className="text-xl font-bold font-mono text-[#0f172a]" id="stat-pages-count">
                        {resolvingPages ? '...' : totalPagesSum}
                      </p>
                    </div>

                    <div className="bg-[#f8fafc] rounded-xl p-3 text-center border border-[#f1f5f9]">
                      <p className="text-[10px] uppercase font-semibold tracking-wider text-[#94a3b8] mb-1">
                        {isAr ? 'الحجم' : 'Size'}
                      </p>
                      <p className="text-xs font-bold font-mono text-[#0f172a] h-7 flex items-center justify-center truncate" id="stat-total-size">
                        {formatBytes(totalCombinedSize, 0)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Tip Badge */}
                  <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100/50 text-[#1e293b] rounded-xl flex gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 text-[#2563eb] mt-0.5" />
                    <p className="text-[11.5px] leading-relaxed text-[#475569]">
                      {t.fileLimitNote}
                    </p>
                  </div>
                </div>

                {/* Configuration Panel */}
                <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-6" id="config-card">
                  <h3 className="text-sm font-bold text-[#0f172a] border-b border-[#f1f5f9] pb-3 mb-4">
                    {isAr ? 'تخصيص الإخراج' : 'Output Settings'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="fileNameInput" className="block text-xs font-semibold text-[#64748b] mb-2">
                        {t.outputFileName}
                      </label>
                      <div className="relative">
                        <input
                          id="fileNameInput"
                          type="text"
                          value={outputName}
                          onChange={(e) => setOutputName(e.target.value)}
                          placeholder={isAr ? 'دمج_ملفات_PDF_احترافي' : 'merged_documents'}
                          className={`w-full px-4 py-3 text-sm bg-[#f8fafc] rounded-xl border border-[#e2e8f0] outline-none focus:border-[#2563eb] focus:bg-white transition-all font-medium ${isAr ? 'pl-12' : 'pr-12'}`}
                        />
                        <span className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'left-3.5' : 'right-3.5'} text-xs font-mono text-[#64748b] font-semibold bg-[#f1f5f9] px-2 py-0.5 rounded`}>
                          .pdf
                        </span>
                      </div>
                    </div>

                    {/* Submit Merge Button */}
                    <button
                      type="button"
                      disabled={totalFilesCount < 2}
                      onClick={handleMergePDFFiles}
                      className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] shadow-md shadow-blue-100 disabled:bg-[#f1f5f9] disabled:text-[#94a3b8] disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
                      id="btn-trigger-merge"
                    >
                      <Combine className="w-4 h-4" />
                      <span>{t.mergeBtn}</span>
                    </button>

                    {/* Reset Workspace List Link */}
                    {totalFilesCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="w-full py-2.5 px-3 bg-[#f8fafc] hover:bg-rose-50 hover:text-rose-600 text-[#64748b] text-xs font-medium rounded-xl border border-[#e2e8f0] hover:border-rose-100 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        id="btn-clear-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.clearAll}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Error Screen Notice */}
                {errorMsg && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex gap-3 shadow-sm" id="error-banner">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold">{isAr ? 'تنبيه خطأ' : 'Processing Error'}</h4>
                      <p className="text-xs leading-relaxed mt-1 text-rose-700">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* Browser local security tag */}
                <div className="p-4 bg-blue-50/20 border border-blue-100/50 rounded-2xl flex gap-3 text-[#1e293b]" id="local-privacy-card">
                  <CheckCircle2 className="w-5 h-5 text-[#2563eb] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">
                    {t.privacyNote}
                  </p>
                </div>

              </div>

              {/* Right Column (Files Interface list) */}
              <div className="lg:col-span-8 flex flex-col gap-5" id="workspace-main">
                
                {/* Drag / Drop Interactive Box */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileDialog}
                  className={`relative p-10 md:p-14 border-2 border-dashed rounded-3xl text-center transition-all duration-300 cursor-pointer ${
                    dragActive 
                      ? 'border-[#2563eb] bg-blue-50/20 scale-[0.99]' 
                      : 'border-[#e2e8f0] hover:border-[#cbd5e1] bg-white hover:bg-[#f8fafc]/50'
                  }`}
                  id="dropzone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="hidden-pdf-uploader"
                  />

                  {/* Centered Graphic Area */}
                  <div className="flex flex-col items-center max-w-sm mx-auto" id="dropzone-content">
                    <div className={`p-4 rounded-xl mb-4 transition-all duration-300 ${
                      dragActive ? 'bg-[#2563eb] text-white scale-110' : 'bg-blue-50 text-[#2563eb]'
                    }`}>
                      <FileUp className="w-8 h-8" />
                    </div>

                    <p className="text-sm md:text-base font-bold text-[#0f172a] mb-1.5 leading-tight">
                      {dragActive ? t.dragActiveText : t.dragDropText}
                    </p>
                    <p className="text-xs md:text-sm text-[#64748b] font-medium mb-3.5">
                      {t.orBrowse}
                    </p>
                    <span className="inline-flex py-1 px-3 bg-[#f1f5f9] rounded-md text-[10px] font-mono text-[#475569] uppercase tracking-wider font-semibold">
                      PDF ONLY
                    </span>
                  </div>
                </div>

                {/* Selected File List */}
                <div className="flex flex-col gap-3" id="files-list-wrapper">
                  <div className="flex items-center justify-between px-1.5" id="list-header-indicator">
                    <span className="text-xs font-bold text-[#94a3b8] tracking-wider uppercase flex items-center gap-1.5">
                      <Files className="w-3.5 h-3.5" />
                      {isAr ? 'قائمة الملفات المحددة للدمج' : 'Documents Queue'}
                    </span>
                    <span className="text-xs font-semibold text-[#64748b]">
                      {totalFilesCount} {isAr ? 'ملف' : 'files'}
                    </span>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {files.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-16 bg-white border border-[#e2e8f0] border-dashed rounded-3xl text-center px-4 text-[#94a3b8]"
                        id="empty-queue-display"
                      >
                        <p className="text-sm font-medium">
                          {isAr ? 'لم تدخل أي مستندات بعد. قم بسحب الملفات هنا للبدء.' : 'No files added yet. Please upload files to begin.'}
                        </p>
                      </motion.div>
                    ) : (
                      <div className="space-y-3" id="files-inner-list">
                        {files.map((file, idx) => (
                          <FileCard
                            key={file.id}
                            pdfFile={file}
                            index={idx}
                            totalFiles={totalFilesCount}
                            lang={lang}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

            </div>
          ) : mergeStatus === 'merging' ? (
            
            /* PROGRESS SCREEN */
            <div className="max-w-md mx-auto py-12" id="progress-monitor">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-8 text-center"
              >
                {/* Loader Pulse Wave */}
                <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[#2563eb]/10 rounded-full animate-ping duration-1000" />
                  <div className="absolute inset-2 bg-[#2563eb]/15 rounded-full animate-pulse" />
                  <div className="relative p-3.5 bg-[#2563eb] text-white rounded-xl shadow-md">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#0f172a] mb-1" id="process-heading-state">
                  {t.merging}
                </h3>
                <p className="text-xs text-[#94a3b8] font-mono mb-6" id="progress-step-tracker">
                  {isAr ? `تجهيز خطوة ${progress.currentStep} من أصل ${progress.totalSteps}` : `Step ${progress.currentStep} of ${progress.totalSteps}`}
                </p>

                {/* Progress bar container */}
                <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 mb-4 overflow-hidden" id="progressbar-outer">
                  <motion.div
                    className="bg-[#2563eb] h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.2 }}
                    id="progressbar-fill"
                  />
                </div>

                {/* Percentage label */}
                <div className="flex items-center justify-between text-xs font-semibold text-[#64748b] mb-6 px-1">
                  <span id="progressbar-percent" className="font-mono text-sm text-[#2563eb] font-bold">{progress.percentage}%</span>
                  <span className="animate-pulse">{isAr ? 'جاري الدمج محلياً...' : 'Merging locally...'}</span>
                </div>

                {/* Info Text */}
                <div className="p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-[#64748b] text-xs lines-clamp-2 min-h-14 flex items-center justify-center [direction:ltr]" id="status-live-log">
                  {progress.message}
                </div>
              </motion.div>
            </div>

          ) : (
            
            /* SUCCESS SCREEN */
            <div className="max-w-xl mx-auto" id="success-sandbox">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-8 text-center"
              >
                {/* Large Green Check Icon */}
                <div className="w-16 h-16 bg-blue-50 text-[#2563eb] rounded-full flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h3 className="text-2xl font-extrabold text-[#0f172a] mb-2">
                  {t.mergedSuccess}
                </h3>
                <p className="text-[#64748b] text-sm max-w-sm mx-auto mb-6">
                  {isAr 
                    ? 'اكتملت العملية بالكامل داخل متصفحك بشكل آمن. يمكنك الآن تحميل الملف المدمج النهائي لتخزينه على جهازك أو معاينته مباشرة.'
                    : 'The merge process completed fully inside your sandboxed browser environment. You can obtain your new document below.'}
                </p>

                {/* Result metadata indicators */}
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center">
                    <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider mb-0.5">
                      {isAr ? 'عدد الصفحات النهائي' : 'Pages'}
                    </span>
                    <span className="text-base font-extrabold text-[#0f172a] font-mono">
                      {totalPagesSum}
                    </span>
                  </div>
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center">
                    <span className="block text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider mb-0.5">
                      {isAr ? 'حجم الملف النهائي' : 'Final Size'}
                    </span>
                    <span className="text-base font-extrabold text-[#0f172a] font-mono">
                      {mergedBlob ? formatBytes(mergedBlob.size) : '---'}
                    </span>
                  </div>
                </div>

                {/* Primary CTA Box */}
                <div className="flex flex-col sm:flex-row items-slate justify-center gap-3 mb-8">
                  {/* Download CTA Button */}
                  <button
                    type="button"
                    onClick={triggerDownload}
                    className="flex-1 py-3.5 px-6 font-bold text-sm bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    id="btn-download-merged"
                  >
                    <FolderDown className="w-5 h-5" />
                    <span>{t.downloadBtn}</span>
                  </button>

                  {/* Reset & Merge more files */}
                  <button
                    type="button"
                    onClick={handleResetMerge}
                    className="py-3.5 px-6 font-bold text-sm bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] rounded-xl transition-all border border-[#cbd5e1]/10 flex items-center justify-center gap-2 cursor-pointer"
                    id="btn-reset-workspace"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{t.mergeAgain}</span>
                  </button>
                </div>

                {/* PREVIEW CONTAINER ACCORDION PANEL */}
                {mergedBlobUrl && (
                  <div className="text-left border-t border-[#e2e8f0] pt-6" id="preview-section">
                    <button
                      type="button"
                      onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                      className="w-full py-2.5 px-4 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-xl flex items-center justify-between text-[#475569] font-bold text-xs sm:text-sm transition-all cursor-pointer"
                      id="btn-toggle-preview"
                    >
                      <span className="flex items-center gap-2 text-[#2563eb]">
                        {isPreviewExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {t.previewTitle}
                      </span>
                      <span className="text-[11px] font-mono text-[#64748b] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
                        {isPreviewExpanded ? (isAr ? 'إخفاء' : 'HIDE') : (isAr ? 'عرض' : 'SHOW')}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isPreviewExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-3"
                          id="preview-iframe-wrapper"
                        >
                          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-1 shadow-inner relative">
                            {/* PDF preview context iframe */}
                            <iframe
                              src={`${mergedBlobUrl}#toolbar=0&navpanes=0`}
                              title="PDF Merger Preview"
                              className="w-full h-96 sm:h-[480px] rounded-xl bg-slate-800"
                              id="merged-pdf-previewer"
                            />
                            
                            {/* Fallback warning notice helper */}
                            <div className="p-3 bg-[#1e293b]/80 border-t border-[#334155] rounded-b-xl flex justify-between items-center text-[11px] text-[#94a3b8] font-medium px-4">
                              <span>Local Object Sandbox URL</span>
                              <span>PDF Object Streamer</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

              </motion.div>
            </div>

          )}
        </div>

      </main>

      {/* Footer Details */}
      <footer className="mt-24 border-t border-[#e2e8f0] bg-white text-[#94a3b8] py-8 text-center text-xs" id="app-footer">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm text-[#94a3b8]" id="footer-security-benefits">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{isAr ? 'تشفير SSL آمن / معالجة محلية' : '100% Client SSL secure'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{isAr ? 'By Ahmed Salem' : 'Zero logs, local sandbox runtime'}</span>
            </div>
          </div>
          <p className="font-medium" id="footer-copyright">
            &copy; 2026 PDF Merger Pro. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
