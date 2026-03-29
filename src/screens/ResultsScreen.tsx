import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  AlertTriangle, 
  AlertCircle,
  ShieldAlert,
  CheckCircle2, 
  User, 
  Hospital, 
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Zap,
  XCircle,
  Info,
  Check,
  MessageSquare,
  Send,
  Loader2
} from 'lucide-react';
import { updateHistoryItemStatus } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';
import { chatWithAuditor } from '../services/geminiService';

export default function ResultsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = location.state || {};
  const { t } = useLanguage();
  const [localStatus, setLocalStatus] = useState<'approved' | 'flagged' | null>(data?.status || null);
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const fileName = `HIB_Audit_${data.patient?.name || 'Claim'}_${new Date().toISOString().split('T')[0]}.txt`;
    
    let report = `==================================================\n`;
    report += `          NEPAL HEALTH INSURANCE BOARD\n`;
    report += `             MEDICAL AUDIT REPORT\n`;
    report += `==================================================\n\n`;
    
    report += `PATIENT INFORMATION:\n`;
    report += `-------------------\n`;
    report += `Name: ${data.patient?.name || 'N/A'}\n`;
    report += `HIB ID: ${data.patient?.health_insurance_number || 'N/A'}\n`;
    report += `Age/Sex: ${data.patient?.age || 'N/A'}Y / ${data.patient?.sex || 'N/A'}\n\n`;
    
    report += `HOSPITAL DETAILS:\n`;
    report += `----------------\n`;
    report += `Hospital: ${data.hospital?.name || 'N/A'}\n`;
    report += `Registration No: ${data.hospital?.registration_no || 'N/A'}\n`;
    report += `Medical Officer: ${data.doctor?.name || 'N/A'} (NMC: ${data.doctor?.nmc_number || 'N/A'})\n\n`;
    
    report += `FINANCIAL SUMMARY:\n`;
    report += `-----------------\n`;
    report += `Total Claimed Amount: Rs. ${data.total_bill_amount?.toLocaleString()}\n`;
    report += `HIB Approved Amount:  Rs. ${data.total_hib_amount?.toLocaleString()}\n`;
    report += `Total Overcharge:     Rs. ${data.overcharge?.toLocaleString()}\n\n`;
    
    report += `AUDIT BREAKDOWN:\n`;
    report += `---------------\n`;
    report += `${'ITEM DESCRIPTION'.padEnd(30)} | ${'QTY'.padEnd(5)} | ${'BILL'.padEnd(10)} | ${'HIB'.padEnd(10)} | ${'STATUS'}\n`;
    report += `-`.repeat(80) + `\n`;
    
    const allItems = [
      ...data.audited_medicines.map((m: any) => ({ ...m, type: 'MED' })),
      ...data.audited_labs.map((l: any) => ({ ...l, type: 'LAB' })),
      ...data.audited_radiology.map((r: any) => ({ ...r, type: 'RAD' })),
      ...data.audited_surgery.map((s: any) => ({ ...s, type: 'SURG' })),
      ...data.audited_general.map((g: any) => ({ ...g, type: 'GEN' }))
    ];
    
    allItems.forEach(item => {
      const name = (item.original_name || 'Unknown').substring(0, 28).padEnd(30);
      const qty = String(item.quantity || 0).padEnd(5);
      const bill = String(item.bill_rate || 0).padEnd(10);
      const hib = String(item.hib_rate || 0).padEnd(10);
      const status = item.status?.toUpperCase() || 'UNKNOWN';
      report += `${name} | ${qty} | ${bill} | ${hib} | ${status}\n`;
    });
    
    report += `\nAI AUDITOR INSIGHTS:\n`;
    report += `-------------------\n`;
    report += `Medical Consistency: ${data.ai_insights?.medical_consistency || 'N/A'}\n`;
    report += `Savings Opportunity: ${data.ai_insights?.savings_opportunity || 'N/A'}\n`;
    if (data.ai_insights?.fraud_flags?.length > 0) {
      report += `Anomalies Flagged: ${data.ai_insights.fraud_flags.join(', ')}\n`;
    }
    
    report += `\n\nGenerated on: ${new Date().toLocaleString()}\n`;
    report += `==================================================\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  if (!data) {
    navigate('/');
    return null;
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isTyping) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await chatWithAuditor(chatHistory, userMsg, data);
      setChatHistory(prev => [...prev, { role: 'model', text: response || 'Sorry, I encountered an error.' }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: 'Sorry, I am unable to respond at the moment.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const isRejected = !data.is_valid_claim;

  const handleStatusUpdate = (status: 'approved' | 'flagged') => {
    if (data.id) {
      updateHistoryItemStatus(data.id, status);
      setLocalStatus(status);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      exact: { 
        bg: 'bg-emerald-50', 
        text: 'text-emerald-700', 
        border: 'border-emerald-200', 
        label: t.hibListedBadge,
        icon: <ShieldCheck className="w-3 h-3" />
      },
      brand: { 
        bg: 'bg-amber-50', 
        text: 'text-amber-700', 
        border: 'border-amber-200', 
        label: t.brandMappedBadge,
        icon: <Zap className="w-3 h-3" />
      },
      not_found: { 
        bg: 'bg-red-50', 
        text: 'text-red-700', 
        border: 'border-red-200', 
        label: t.notCoveredBadge,
        icon: <XCircle className="w-3 h-3" />
      }
    }[status as 'exact' | 'brand' | 'not_found'] || { 
      bg: 'bg-gray-50', 
      text: 'text-gray-700', 
      border: 'border-gray-200', 
      label: t.unknownBadge,
      icon: <Info className="w-3 h-3" />
    };

    return (
      <span className={`inline-flex items-center gap-1.5 text-[9px] font-black px-2 py-1 border-b-2 ${config.border} ${config.bg} ${config.text} uppercase tracking-tight`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-bg text-[#1E293B] font-sans pb-20">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-3 sm:p-4 flex justify-between items-center shadow-sm print:hidden">
        <div className="flex gap-2 sm:gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 sm:gap-2 font-black uppercase text-[8px] sm:text-[10px] tracking-widest text-slate-500 hover:text-brand-primary transition-colors">
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">{t.backToUpload}</span><span className="xs:hidden">Back</span>
          </button>
          <button onClick={() => navigate('/history')} className="flex items-center gap-1.5 sm:gap-2 font-black uppercase text-[8px] sm:text-[10px] tracking-widest text-slate-500 hover:text-brand-primary transition-colors border-l border-slate-200 pl-2 sm:pl-4">
            <span className="hidden xs:inline">{t.viewHistory}</span><span className="xs:hidden">History</span>
          </button>
        </div>
        <div className="flex gap-1 sm:gap-2 print:hidden">
          <button 
            onClick={handlePrint}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-all"
            title={t.printReport || "Print Report"}
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button 
            onClick={handleDownload}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-all"
            title={t.downloadReport || "Download Report"}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Validation Status */}
        {isRejected ? (
          <div className="bg-white border-2 border-red-500 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-red-100">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-red-600">{t.claimRejected}</h2>
                <p className="text-xs sm:text-sm font-bold mt-1 text-slate-500">{t.missingElements}</p>
                <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {data.missing_items?.map((item: string, i: number) => (
                    <div key={i} className="bg-red-50 border border-red-100 p-3 sm:p-4 rounded-xl flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight text-red-700">{item.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{t.actionRequired}</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">{data.recovery_suggestion || t.recoverySuggestion}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-emerald-500 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-emerald-100">
            <div className="flex items-start gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-emerald-600">{t.claimVerified}</h2>
                <p className="text-xs sm:text-sm font-bold text-slate-500">{t.verifiedSummary}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* High Value Claim Warning */}
        {!isRejected && data.total_hib_amount > 5000 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border-2 border-amber-500 p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl shadow-amber-100 flex items-start gap-4 sm:gap-6"
          >
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-amber-700">{(t as any).highClaimWarning}</h3>
              <p className="text-xs sm:text-sm font-bold text-amber-600 mt-1">{(t as any).highClaimWarningDesc}</p>
            </div>
          </motion.div>
        )}

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" /> {t.patientInfo}
            </h3>
            <div>
              <p className="text-xl font-black uppercase tracking-tighter text-slate-900">{data.patient?.name || "N/A"}</p>
              <p className="text-xs font-bold text-brand-primary mt-1">HIB ID: {data.patient?.health_insurance_number || "MISSING"}</p>
              <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-tight">{data.patient?.age}Y • {data.patient?.sex}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Hospital className="w-3 h-3" /> {t.hospitalDetails}
            </h3>
            <div>
              <p className="text-xl font-black uppercase tracking-tighter text-slate-900">{data.hospital?.name || "N/A"}</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tight">REG: {data.hospital?.registration_no || "N/A"}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <Stethoscope className="w-3 h-3" /> {t.medicalOfficer}
            </h3>
            <div>
              <p className="text-xl font-black uppercase tracking-tighter text-slate-900">{data.doctor?.name || "N/A"}</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tight">NMC: {data.doctor?.nmc_number || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Diagnosis Row */}
        {!isRejected && data.diagnosis && data.diagnosis.length > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-brand-primary" /> {t.diagnosisLabel}
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.diagnosis.map((d: any, i: number) => (
                <div key={i} className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl flex items-center gap-3">
                  <span className="text-sm font-black uppercase tracking-tight text-slate-700">{d.name}</span>
                  {d.icd10_code && (
                    <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      {d.icd10_code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary */}
        {!isRejected && (
          <div className="bg-brand-primary text-white p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl shadow-brand-primary/30 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="text-center md:text-left relative z-10 w-full md:w-auto">
              <p className="text-[8px] sm:text-[10px] font-black uppercase opacity-60 tracking-widest mb-1 sm:mb-2">{t.totalClaimed}</p>
              <p className="text-4xl sm:text-7xl font-black tracking-tighter">Rs. {data.total_bill_amount?.toLocaleString()}</p>
            </div>
            <div className="w-full h-px md:w-px md:h-24 bg-white/20 relative z-10"></div>
            <div className="text-center md:text-left relative z-10 w-full md:w-auto">
              <p className="text-[8px] sm:text-[10px] font-black uppercase opacity-60 tracking-widest mb-1 sm:mb-2">{t.hibApproved}</p>
              <p className="text-4xl sm:text-7xl font-black tracking-tighter text-emerald-300">Rs. {data.total_hib_amount?.toLocaleString()}</p>
            </div>
            <div className="w-full h-px md:w-px md:h-24 bg-white/20 relative z-10"></div>
            <div className="text-center md:text-left relative z-10 w-full md:w-auto">
              <p className="text-[8px] sm:text-[10px] font-black uppercase opacity-60 tracking-widest mb-1 sm:mb-2">{t.overcharge}</p>
              <div className="flex items-baseline gap-3 justify-center md:justify-start">
                <p className={`text-4xl sm:text-7xl font-black tracking-tighter ${data.overcharge > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  Rs. {data.overcharge?.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Audit Table (Swapped to be before Insights) */}
        {!isRejected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest">{t.auditBreakdown}</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-bold uppercase opacity-60">{t.hibListed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-[10px] font-bold uppercase opacity-60">{t.brandMapping}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-[10px] font-bold uppercase opacity-60">{t.notFound}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Desktop Header */}
              <div className="hidden sm:grid bg-slate-900 text-white p-4 font-mono text-[10px] uppercase font-bold grid-cols-12 gap-4">
                <div className="col-span-5">{t.itemDescription}</div>
                <div className="col-span-2 text-center">{t.status}</div>
                <div className="col-span-1 text-center">{t.qty}</div>
                <div className="col-span-2 text-right">{t.billRate}</div>
                <div className="col-span-2 text-right">{t.hibRate}</div>
              </div>

              <div className="divide-y divide-slate-100">
                {[
                  ...data.audited_medicines.map((m: any) => ({ ...m, type: 'MED' })),
                  ...data.audited_labs.map((l: any) => ({ ...l, type: 'LAB' })),
                  ...data.audited_radiology.map((r: any) => ({ ...r, type: 'RAD' })),
                  ...data.audited_surgery.map((s: any) => ({ ...s, type: 'SURG' })),
                  ...data.audited_general.map((g: any) => ({ ...g, type: 'GEN' }))
                ].map((item, i) => {
                  const isRateMismatch = item.bill_rate !== item.hib_rate && item.status !== 'not_found';
                  
                  return (
                    <div key={i} className={`p-4 flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 items-start sm:items-center hover:bg-gray-50 transition-colors ${isRateMismatch ? 'bg-amber-50/30' : ''}`}>
                      <div className="col-span-5 w-full">
                        <p className="text-[8px] sm:text-[10px] font-mono font-bold opacity-30 mb-1">{item.type} • {item.hib_code}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm uppercase tracking-tighter">{item.original_name}</p>
                          {isRateMismatch && (
                            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertCircle className="w-2 h-2" />
                              RATE MISMATCH
                            </span>
                          )}
                        </div>
                        {item.flag === 'UNNECESSARY_INVESTIGATION' && (
                        <div className="mt-1 flex items-center gap-1.5 bg-red-50 text-red-600 px-2 py-0.5 rounded-md border border-red-100 w-fit">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Unnecessary Investigation</span>
                        </div>
                      )}
                      {item.status === 'brand' && (
                        <p className="text-[10px] italic opacity-60 mt-1">Mapped to: {item.name}</p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] text-amber-600 font-medium mt-1 flex items-start gap-1">
                          <Info className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{item.notes}</span>
                        </p>
                      )}
                    </div>
                    
                    <div className="flex sm:contents justify-between items-center w-full">
                      <div className="sm:col-span-2 flex sm:justify-center">
                        <StatusBadge status={item.status} />
                      </div>
                      
                      <div className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.details}</div>
                    </div>

                    <div className="flex sm:contents justify-between items-center w-full border-t border-slate-50 pt-2 sm:pt-0 sm:border-0">
                      <div className="sm:col-span-1 text-center font-mono text-sm flex items-center gap-2 sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.qtyLabel}</span>
                        {item.quantity}
                      </div>
                      <div className="sm:col-span-2 text-right font-mono text-sm flex items-center gap-2 sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.billLabel}</span>
                        Rs. {item.bill_rate}
                      </div>
                      <div className="sm:col-span-2 text-right font-mono text-sm font-bold flex items-center gap-2 sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.hibLabel}</span>
                        Rs. {item.hib_rate}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}

        {/* AI Auditor Insights (Swapped to be after Table) */}
        {data.ai_insights && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{t.aiInsights}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.fraudAnomaly}</p>
                {data.ai_insights.fraud_flags?.length > 0 ? (
                  <div className="space-y-2">
                    {data.ai_insights.fraud_flags.map((flag: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-lg">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-tight">{flag}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 font-black uppercase tracking-tight flex items-center gap-2 bg-emerald-50 p-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" /> {t.noAnomalies}
                  </p>
                )}
              </div>

              <div className="space-y-3 md:border-l md:border-slate-100 md:pl-10">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.medicalConsistency}</p>
                <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                  {data.ai_insights.medical_consistency || t.consistencyDefault}
                </p>
              </div>

              <div className="space-y-3 md:border-l md:border-slate-100 md:pl-10">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.savingsOpportunity}</p>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-tight bg-emerald-50 p-3 rounded-xl">
                  {data.ai_insights.savings_opportunity || t.savingsDefault}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notes Section */}
        {data.notes && (
          <div className="bg-white border border-[#141414] p-6">
            <h3 className="text-[10px] font-mono font-bold uppercase opacity-40 mb-4">{t.auditorNotes}</h3>
            <p className="text-sm italic opacity-80 leading-relaxed">"{data.notes}"</p>
          </div>
        )}

        {/* Action Bar */}
        {!isRejected && (
          <div className="flex flex-col md:flex-row gap-4 pt-8 print:hidden">
            <button 
              onClick={() => handleStatusUpdate('approved')}
              disabled={localStatus === 'approved'}
              className={`flex-1 py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                localStatus === 'approved' 
                ? "bg-emerald-600 text-white cursor-default" 
                : "bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90"
              }`}
            >
              {localStatus === 'approved' && <Check className="w-5 h-5" />}
              {localStatus === 'approved' ? t.claimApproved : t.approveClaim}
            </button>
            <button 
              onClick={() => handleStatusUpdate('flagged')}
              disabled={localStatus === 'flagged'}
              className={`flex-1 border-2 py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                localStatus === 'flagged'
                ? "border-amber-500 bg-amber-50 text-amber-700 cursor-default"
                : "border-[#141414] hover:bg-white"
              }`}
            >
              {localStatus === 'flagged' && <AlertTriangle className="w-5 h-5" />}
              {localStatus === 'flagged' ? t.claimFlagged : t.flagForReview}
            </button>
            {localStatus === 'flagged' && (
              <button 
                onClick={() => navigate('/review-details', { state: { data } })}
                className="flex-1 bg-amber-500 text-white py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-amber-600 shadow-lg shadow-amber-200"
              >
                <ShieldAlert className="w-5 h-5" />
                {t.reviewDetails}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Smart Assistant */}
      <div className="fixed bottom-6 right-6 z-50 print:hidden">
        {isChatOpen ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-[350px] sm:w-[400px] h-[500px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Chat Header */}
            <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Smart Auditor</p>
                  <p className="text-[10px] opacity-70">Powered by Google Intelligence</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {chatHistory.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Ask me anything about this audit</p>
                  <p className="text-[10px] text-slate-400 px-10">I can explain HIB rules, clarify flags, or help you understand the clinical reasoning.</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                    msg.role === 'user' 
                    ? 'bg-brand-primary text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-brand-primary" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                type="text" 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-medium focus:ring-2 focus:ring-brand-primary transition-all"
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim() || isTyping}
                className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center hover:bg-opacity-90 disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsChatOpen(true)}
            className="bg-brand-primary text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div className="text-left pr-2">
              <p className="text-[10px] font-black uppercase tracking-widest">Smart Assistant</p>
              <p className="text-[8px] opacity-70 uppercase font-bold">Ask about this audit</p>
            </div>
          </motion.button>
        )}
      </div>
    </div>
  );
}
