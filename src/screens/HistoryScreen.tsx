import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Clock, 
  Trash2, 
  ChevronRight, 
  Search, 
  Calendar, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  FileText 
} from 'lucide-react';
import { getHistory, deleteHistoryItem, cleanupHistory, HistoryItem, clearHistory } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    cleanupHistory();
    setHistory(getHistory());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteHistoryItem(id);
    setHistory(getHistory());
  };

  const handleClearAll = () => {
    clearHistory();
    setHistory([]);
    setShowClearModal(false);
  };

  const filteredHistory = history.filter(item => {
    const patientName = item.data.patient?.name?.toLowerCase() || '';
    const hospitalName = item.data.hospital?.name?.toLowerCase() || '';
    return patientName.includes(searchTerm.toLowerCase()) || hospitalName.includes(searchTerm.toLowerCase());
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-[#1E293B] font-sans pb-20">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-3 sm:p-4 flex justify-between items-center shadow-sm">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 sm:gap-2 font-black uppercase text-[8px] sm:text-[10px] tracking-widest text-slate-500 hover:text-brand-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">{t.backToUpload}</span><span className="xs:hidden">Back</span>
        </button>
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-lg">
          <Clock className="w-3 h-3" />
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">{t.auditHistory}</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-slate-900">{t.auditLogs}</h2>
            {history.length > 0 && (
              <button 
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
              >
                <Trash2 className="w-3 h-3" /> Clear All
              </button>
            )}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="bg-white p-8 sm:p-12 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-200" />
            </div>
            <p className="font-black uppercase tracking-widest text-xs sm:text-sm text-slate-400">{t.noAudits}</p>
            <button 
              onClick={() => navigate('/')}
              className="text-[10px] sm:text-xs font-black text-brand-primary uppercase tracking-tighter hover:opacity-60 transition-opacity"
            >
              {t.startNewAudit}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredHistory.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/results', { state: { data: item.data } })}
                className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 cursor-pointer transition-all group relative overflow-hidden"
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  item.status === 'approved' 
                    ? "bg-emerald-500" 
                    : item.status === 'flagged'
                    ? "bg-amber-500"
                    : item.data.is_valid_claim 
                    ? "bg-slate-200" 
                    : "bg-red-500"
                }`}></div>

                <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    item.status === 'approved' 
                      ? "bg-emerald-50 text-emerald-500" 
                      : item.status === 'flagged'
                      ? "bg-amber-50 text-amber-500"
                      : item.data.is_valid_claim 
                      ? "bg-slate-50 text-slate-400" 
                      : "bg-red-50 text-red-500"
                  }`}>
                    {item.status === 'approved' ? (
                      <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
                    ) : item.status === 'flagged' ? (
                      <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7" />
                    ) : item.data.is_valid_claim ? (
                      <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
                    ) : (
                      <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg sm:text-xl font-black uppercase tracking-tighter text-slate-900 truncate">{item.data.patient?.name || "Unknown Patient"}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{item.data.hospital?.name || "Unknown Hospital"}</p>
                      {item.data.ai_insights?.fraud_flags?.length > 0 && (
                        <span className="text-[7px] sm:text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-2 h-2" /> ANOMALY
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {item.status === 'flagged' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/review-details', { state: { data: item.data } });
                        }}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                      >
                        {t.reviewDetails}
                      </button>
                    )}
                    <div className="flex items-center justify-between w-full md:w-auto md:gap-8 lg:gap-12 border-t border-slate-50 pt-4 md:pt-0 md:border-0">
                      <div className="text-left md:text-right">
                        <p className="text-[8px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5 sm:mb-1">{t.auditDate}</p>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-700">{formatDate(item.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5 sm:mb-1">{t.hibAmount}</p>
                        <p className="text-xs sm:text-sm font-black text-emerald-600">Rs. {item.data.total_hib_amount?.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <button 
                          onClick={(e) => handleDelete(e, item.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-2 text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-slate-200 flex items-start gap-4 sm:gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
          </div>
          <div className="space-y-1 sm:space-y-2 relative z-10">
            <p className="text-[8px] sm:text-[10px] font-black uppercase text-amber-400 tracking-widest">{t.privacyNotice}</p>
            <p className="text-[10px] sm:text-xs font-medium text-slate-300 leading-relaxed">
              {t.privacyNoticeDesc}
            </p>
          </div>
        </div>
      </main>

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 space-y-6"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Clear All History?</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                This will permanently delete all your audit logs. This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={handleClearAll}
                className="w-full bg-red-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
              >
                Yes, Clear Everything
              </button>
              <button 
                onClick={() => setShowClearModal(false)}
                className="w-full bg-slate-100 text-slate-600 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
