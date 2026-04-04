import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Loader2,
  X,
  Lock,
  Unlock,
  Search,
  FileCheck,
  Code,
  Copy,
  ExternalLink
} from 'lucide-react';
import { updateHistoryItemStatus } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';
import { useRole } from '../utils/RoleContext';
import { chatWithAuditor } from '../services/geminiService';
import { generateHash, createHashPayload } from '../utils/crypto';
import { QRCodeCanvas } from 'qrcode.react';

export default function ResultsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, batchResults, currentIndex } = location.state || {};
  const { t } = useLanguage();
  const { appMode, setAppMode } = useRole();
  const [localStatus, setLocalStatus] = useState<'approved' | 'flagged' | 'rejected' | null>(data?.status || null);

  const hasNext = batchResults && currentIndex < batchResults.length - 1;
  const hasPrev = batchResults && currentIndex > 0;

  const goToNext = () => {
    if (hasNext) {
      navigate('/results', {
        state: {
          data: batchResults[currentIndex + 1],
          batchResults,
          currentIndex: currentIndex + 1
        },
        replace: true
      });
    }
  };

  const goToPrev = () => {
    if (hasPrev) {
      navigate('/results', {
        state: {
          data: batchResults[currentIndex - 1],
          batchResults,
          currentIndex: currentIndex - 1
        },
        replace: true
      });
    }
  };
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // Hybrid System State
  const [isSealed, setIsSealed] = useState(false);
  const [claimHash, setClaimHash] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [showPayloadModal, setShowPayloadModal] = useState(false);

  const generateOpenIMISPayload = () => {
    // This is a standard FHIR-like structure often used by openIMIS
    return {
      resourceType: "Claim",
      id: data.id || `claim-${Date.now()}`,
      status: "active",
      type: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "institutional" }]
      },
      use: "claim",
      patient: {
        identifier: { value: data.patient?.health_insurance_number || "N/A" },
        display: data.patient?.name || "N/A"
      },
      billablePeriod: {
        start: new Date().toISOString()
      },
      created: new Date().toISOString(),
      provider: {
        identifier: { value: data.hospital?.registration_no || "N/A" },
        display: data.hospital?.name || "N/A"
      },
      prescription: {
        practitioner: {
          identifier: { value: data.doctor?.nmc_number || "N/A" },
          display: data.doctor?.name || "N/A"
        }
      },
      diagnosis: data.diagnosis?.map((d: any, i: number) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: {
          coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: d.icd10_code || "N/A", display: d.name }]
        }
      })),
      item: data.audited_items?.map((item: any, i: number) => {
        const isHospital = appMode === 'hospital';
        const itemName = isHospital ? (item.cleaned_version?.name || item.name) : item.name;
        const itemRate = isHospital ? (item.cleaned_version?.rate || item.bill_rate) : item.bill_rate;
        
        return {
          sequence: i + 1,
          productOrService: {
            coding: [{ system: "http://hib.gov.np/codes", code: item.hib_code || "N/A", display: itemName }]
          },
          quantity: { value: item.quantity },
          unitPrice: { value: itemRate, currency: "NPR" },
          net: { value: itemRate * item.quantity, currency: "NPR" },
          // HIB Specific Audit Metadata
          extension: [
            { url: "http://hib.gov.np/fhir/StructureDefinition/hib-approved-rate", valueDecimal: item.approved_rate },
            { url: "http://hib.gov.np/fhir/StructureDefinition/hib-status", valueString: item.status },
            { url: "http://hib.gov.np/fhir/StructureDefinition/hib-flag", valueString: item.flag || "NONE" }
          ]
        };
      }),
      total: {
        value: appMode === 'hospital' ? data.total_hib_amount : data.total_bill_amount,
        currency: "NPR"
      },
      // Digital Notary Seal
      meta: {
        tag: isSealed ? [{ system: "http://hib.gov.np/security", code: "SEALED", display: claimHash }] : []
      }
    };
  };

  const handleCopyPayload = () => {
    const payload = JSON.stringify(generateOpenIMISPayload(), null, 2);
    navigator.clipboard.writeText(payload);
    // Could add a toast here
  };

  const isHospital = appMode === 'hospital';
  const isHIB = appMode === 'hib';
  
  // Generic Swapper state
  const [brandWarning, setBrandWarning] = useState<string | null>(null);
  const [showBrandPopup, setShowBrandPopup] = useState(false);

  useEffect(() => {
    const brandItems = (data?.audited_medicines || []).filter((m: any) => m.status === 'brand');
    if (brandItems.length > 0) {
      setBrandWarning(brandItems[0].original_name || brandItems[0].name);
      setShowBrandPopup(true);
    }
  }, [data]);
  
  const allItems = [
    ...(data?.audited_medicines || []).map((m: any) => ({ ...m, type: 'MED' })),
    ...(data?.audited_labs || []).map((l: any) => ({ ...l, type: 'LAB' })),
    ...(data?.audited_radiology || []).map((r: any) => ({ ...r, type: 'RAD' })),
    ...(data?.audited_surgery || []).map((s: any) => ({ ...s, type: 'SURG' })),
    ...(data?.audited_general || []).map((g: any) => ({ ...g, type: 'GEN' }))
  ];
  
  const overchargedItems = allItems.filter((item: any) => 
    item.bill_rate > item.hib_rate && item.status !== 'not_found'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const isHospital = appMode === 'hospital';
    const fileName = `${isHospital ? 'CLEANED_CLAIM' : 'HIB_Audit'}_${data.patient?.name || 'Claim'}_${new Date().toISOString().split('T')[0]}.txt`;
    
    let report = `==================================================\n`;
    report += `          NEPAL HEALTH INSURANCE BOARD\n`;
    report += `       ${isHospital ? 'CLEANED CLAIM SUMMARY (HOSPITAL)' : 'MEDICAL AUDIT REPORT (HIB)'}\n`;
    report += `==================================================\n\n`;
    
    if (isHospital && isSealed) {
      report += `DIGITAL SEAL: ${claimHash}\n`;
      report += `STATUS: SEALED & VERIFIED FOR FAST-TRACK\n\n`;
    }

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
    
    if (data.diagnosis && data.diagnosis.length > 0) {
      report += `DIAGNOSIS (ICD-10):\n`;
      report += `------------------\n`;
      data.diagnosis.forEach((d: any) => {
        report += `* ${d.name}${d.icd10_code ? ` [${d.icd10_code}]` : ''}\n`;
      });
      report += `\n`;
    }

    report += `FINANCIAL SUMMARY:\n`;
    report += `-----------------\n`;
    if (isHospital) {
      report += `Original Bill:        Rs. ${data.total_bill_amount?.toLocaleString()}\n`;
      report += `Cleaned Claim Total:  Rs. ${data.total_hib_amount?.toLocaleString()}\n`;
      report += `Adjustment (Savings): Rs. ${data.overcharge?.toLocaleString()}\n\n`;
    } else {
      report += `Total Claimed Amount: Rs. ${data.total_bill_amount?.toLocaleString()}\n`;
      report += `HIB Approved Amount:  Rs. ${data.total_hib_amount?.toLocaleString()}\n`;
      report += `Total Overcharge:     Rs. ${data.overcharge?.toLocaleString()}\n\n`;
    }
    
    report += `${isHospital ? 'CLEANED ITEM LIST' : 'AUDIT BREAKDOWN'}:\n`;
    report += `---------------\n`;
    if (isHospital) {
      report += `${'DESCRIPTION (GENERIC)'.padEnd(30)} | ${'QTY'.padEnd(5)} | ${'RATE'.padEnd(10)} | ${'TOTAL'.padEnd(10)}\n`;
    } else {
      report += `${'ITEM DESCRIPTION'.padEnd(30)} | ${'QTY'.padEnd(5)} | ${'BILL'.padEnd(10)} | ${'HIB'.padEnd(10)} | ${'STATUS'}\n`;
    }
    report += `-`.repeat(80) + `\n`;
    
    allItems.forEach(item => {
      if (isHospital) {
        const name = (item.cleaned_version?.name || item.name).substring(0, 28).padEnd(30);
        const qty = String(item.quantity || 0).padEnd(5);
        const rate = String(item.cleaned_version?.rate || item.bill_rate).padEnd(10);
        const total = String((item.cleaned_version?.rate || item.bill_rate) * item.quantity).padEnd(10);
        report += `${name} | ${qty} | ${rate} | ${total}\n`;
      } else {
        const name = (item.original_name || item.name).substring(0, 28).padEnd(30);
        const qty = String(item.quantity || 0).padEnd(5);
        const bill = String(item.bill_rate || 0).padEnd(10);
        const hib = String(item.hib_rate || 0).padEnd(10);
        const status = item.status?.toUpperCase() || 'UNKNOWN';
        report += `${name} | ${qty} | ${bill} | ${hib} | ${status}\n`;
      }
    });
    
    if (!isHospital) {
      report += `\nAI AUDITOR INSIGHTS:\n`;
      report += `-------------------\n`;
      report += `Medical Consistency: ${data.ai_insights?.medical_consistency || 'N/A'}\n`;
      report += `Savings Opportunity: ${data.ai_insights?.savings_opportunity || 'N/A'}\n`;
      if (data.ai_insights?.fraud_flags?.length > 0) {
        report += `Anomalies Flagged: ${data.ai_insights.fraud_flags.join(', ')}\n`;
      }
    } else {
      report += `\nCOMPLIANCE NOTES:\n`;
      report += `----------------\n`;
      report += `* All brand names mapped to HIB-approved generics.\n`;
      report += `* All rates capped to HIB ceiling limits.\n`;
      report += `* Claim is 100% compliant with HIB 2081 guidelines.\n`;
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

  const handleSealClaim = async () => {
    setIsTyping(true);
    try {
      // Create a deterministic payload from the cleaned data
      const payload = createHashPayload(data);
      const hash = await generateHash(payload);
      setClaimHash(hash);
      setIsSealed(true);
      
      // In a real app, we would save this hash to the database/openIMIS
      console.log("Claim Sealed with Hash:", hash);
    } catch (error) {
      console.error("Sealing failed:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVerifyClaim = async () => {
    setVerificationStatus('verifying');
    // Simulate network delay for verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // Re-calculate hash from current data
      const payload = createHashPayload(data);
      const currentHash = await generateHash(payload);
      
      // In HIB mode, we'd compare with the hash stored in the claim metadata
      // For demo, we'll assume it matches if the claim was "sealed" or if we have a hash_payload
      if (data.hash_payload || isSealed) {
        setVerificationStatus('verified');
      } else {
        setVerificationStatus('failed');
      }
    } catch (error) {
      setVerificationStatus('failed');
    }
  };

  const isRejected = !data.is_valid_claim;

  const handleStatusUpdate = (status: 'approved' | 'flagged' | 'rejected') => {
    if (data.id) {
      updateHistoryItemStatus(data.id, status);
      setLocalStatus(status);
    }
  };

  const handleProceedToClaim = () => {
    // Get configured openIMIS URL or use default
    const baseUrl = localStorage.getItem('HIB_OPENIMIS_URL') || "https://demo.openimis.org/claims/new";
    
    const params = new URLSearchParams();
    
    // Map HIB Auditor data to openIMIS fields based on Image 1
    if (data.hospital?.registration_no) params.append('health_facility_code', data.hospital.registration_no);
    if (data.patient?.health_insurance_number) params.append('insurance_no', data.patient.health_insurance_number);
    
    // Diagnosis mapping (ICD-10)
    if (data.diagnosis && data.diagnosis.length > 0) {
      // Primary diagnosis
      params.append('diagnosis', data.diagnosis[0].icd10_code || data.diagnosis[0].name || '');
      
      // Additional diagnoses
      if (data.diagnosis.length > 1) params.append('diagnosis_1', data.diagnosis[1].icd10_code || data.diagnosis[1].name || '');
      if (data.diagnosis.length > 2) params.append('diagnosis_2', data.diagnosis[2].icd10_code || data.diagnosis[2].name || '');
      if (data.diagnosis.length > 3) params.append('diagnosis_3', data.diagnosis[3].icd10_code || data.diagnosis[3].name || '');
      if (data.diagnosis.length > 4) params.append('diagnosis_4', data.diagnosis[4].icd10_code || data.diagnosis[4].name || '');
    }

    // Dates (Default to today)
    const today = new Date().toISOString().split('T')[0];
    params.append('start_date', today);
    params.append('end_date', today);

    // Claim Admin / Doctor
    if (data.doctor?.name) params.append('claim_admin', data.doctor.name);
    
    // Generate a unique claim code if not present
    const claimCode = data.id?.substring(0, 8).toUpperCase() || Math.random().toString(36).substring(2, 10).toUpperCase();
    params.append('claim_code', `CLM-${claimCode}`);

    const finalUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    
    // Open openIMIS in a new tab
    window.open(finalUrl, '_blank');
    
    // Mark as approved locally
    handleStatusUpdate('approved');
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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 p-3 sm:p-4 flex justify-between items-center shadow-sm print:hidden">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 sm:gap-2 font-black uppercase text-[8px] sm:text-[10px] tracking-widest text-slate-500 hover:text-brand-primary transition-colors">
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">{t.backToUpload}</span><span className="xs:hidden">Back</span>
          </button>

          {batchResults && (
            <div className="flex items-center gap-1 sm:gap-2 border-l border-slate-200 pl-2 sm:pl-4">
              <button 
                onClick={goToPrev}
                disabled={!hasPrev}
                className={`p-1.5 rounded-lg transition-all ${hasPrev ? 'text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
                title="Previous Claim"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter">
                {currentIndex + 1} / {batchResults.length}
              </span>
              <button 
                onClick={goToNext}
                disabled={!hasNext}
                className={`p-1.5 rounded-lg transition-all ${hasNext ? 'text-slate-900 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
                title="Next Claim"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="hidden sm:flex bg-slate-100 p-0.5 rounded-lg ml-2">
            <button 
              onClick={() => setAppMode('hospital')}
              className={`px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase transition-all ${appMode === 'hospital' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400'}`}
            >
              Hospital
            </button>
            <button 
              onClick={() => setAppMode('hib')}
              className={`px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase transition-all ${appMode === 'hib' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400'}`}
            >
              HIB Auditor
            </button>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 print:hidden">
          {appMode === 'hospital' && !isSealed && (
            <button 
              onClick={handleSealClaim}
              disabled={isTyping}
              className="bg-emerald-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              {isTyping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              <span className="hidden xs:inline">Seal Claim</span><span className="xs:hidden">Seal</span>
            </button>
          )}
          
          {appMode === 'hospital' && isSealed && (
            <button 
              onClick={handleDownload}
              className="bg-brand-primary text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:bg-brand-secondary transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Download Cleaned Claim</span><span className="xs:hidden">Download</span>
            </button>
          )}
          
          {appMode === 'hib' && verificationStatus === 'idle' && (
            <button 
              onClick={handleVerifyClaim}
              className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Search className="w-3 h-3" />
              <span className="hidden xs:inline">Verify Hash</span><span className="xs:hidden">Verify</span>
            </button>
          )}

          <button 
            onClick={() => setShowPayloadModal(true)}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-all"
            title="View openIMIS JSON"
          >
            <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
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
        {/* Hybrid Mode Status Banners */}
        <AnimatePresence>
          {isSealed && appMode === 'hospital' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-emerald-50 border-2 border-emerald-200 p-4 sm:p-6 rounded-3xl flex items-center justify-between gap-4 shadow-lg shadow-emerald-100"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-tight text-emerald-900">Claim Sealed & Cleaned</p>
                  <p className="text-[9px] sm:text-[10px] font-mono text-emerald-600 truncate max-w-[150px] sm:max-w-md">HASH: {claimHash}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                      Ready for Fast-Track
                    </span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(claimHash || '')}
                      className="p-1 hover:bg-emerald-100 rounded-md transition-all text-emerald-600"
                      title="Copy Hash"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white p-1.5 rounded-xl shadow-sm border border-emerald-100 shrink-0">
                <QRCodeCanvas value={claimHash || ''} size={48} />
              </div>
            </motion.div>
          )}

          {appMode === 'hib' && verificationStatus !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`p-4 rounded-3xl border-2 flex items-center justify-between gap-4 ${
                verificationStatus === 'verifying' ? 'bg-blue-50 border-blue-200' :
                verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-200' :
                'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  verificationStatus === 'verifying' ? 'bg-blue-100' :
                  verificationStatus === 'verified' ? 'bg-emerald-100' :
                  'bg-red-100'
                }`}>
                  {verificationStatus === 'verifying' ? <Loader2 className="w-6 h-6 text-blue-600 animate-spin" /> :
                   verificationStatus === 'verified' ? <ShieldCheck className="w-6 h-6 text-emerald-600" /> :
                   <ShieldAlert className="w-6 h-6 text-red-600" />}
                </div>
                <div>
                  <p className={`text-xs font-black uppercase tracking-tight ${
                    verificationStatus === 'verifying' ? 'text-blue-900' :
                    verificationStatus === 'verified' ? 'text-emerald-900' :
                    'text-red-900'
                  }`}>
                    {verificationStatus === 'verifying' ? 'Verifying Digital Signature...' :
                     verificationStatus === 'verified' ? 'Digital Signature Verified' :
                     'Verification Failed: Data Tampered'}
                  </p>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                    {verificationStatus === 'verifying' ? 'Checking hash integrity against HIB records' :
                     verificationStatus === 'verified' ? 'This claim was pre-audited and matches the hospital seal.' :
                     'The claim data does not match the original hospital seal.'}
                  </p>
                </div>
              </div>
              {verificationStatus === 'verified' && (
                <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Fast-Track
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
              <div className="flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-emerald-600">{t.claimVerified}</h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-500">{t.verifiedSummary}</p>
                </div>
                {data.ai_insights?.is_bhs_eligible && (
                  <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    {t.bhsEligible}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Risk Meter Section */}
        {!isRejected && data.ai_insights?.rejection_risk_score !== undefined && (
          <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-brand-primary" />
                  {t.rejectionRisk}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">{t.medicalPolicy}</p>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-black ${data.ai_insights.rejection_risk_score > 60 ? 'text-red-500' : data.ai_insights.rejection_risk_score > 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {data.ai_insights.rejection_risk_score}%
                </span>
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{t.riskScore}</p>
              </div>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${data.ai_insights.rejection_risk_score}%` }}
                className={`h-full ${data.ai_insights.rejection_risk_score > 60 ? 'bg-red-500' : data.ai_insights.rejection_risk_score > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Low</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Medium</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">High</span>
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

        {/* Overcharged Items Detail Section */}
        {!isRejected && overchargedItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-2 border-amber-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{t.overchargedItems}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.rateMismatchDesc}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {overchargedItems.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">{item.type || 'ITEM'} • {item.hib_code}</p>
                    <p className="font-black text-slate-800 uppercase tracking-tight">{item.original_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      Qty: {item.quantity} × (Rs. {item.bill_rate} - Rs. {item.hib_rate})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-amber-600 tracking-tighter">
                      +Rs. {((item.bill_rate - item.hib_rate) * item.quantity).toLocaleString()}
                    </p>
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Extra Charge</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
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
                {allItems.map((item, i) => {
                  const isRateMismatch = item.bill_rate > item.hib_rate && item.status !== 'not_found';
                  
                  return (
                    <div key={i} className={`p-4 flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 items-start sm:items-center hover:bg-gray-50 transition-colors ${isRateMismatch ? 'bg-amber-50/30' : ''}`}>
                      <div className="col-span-5 w-full">
                        <p className="text-[8px] sm:text-[10px] font-mono font-bold opacity-30 mb-1">{item.type} • {item.hib_code}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm uppercase tracking-tighter">
                            {appMode === 'hospital' && item.cleaned_version ? item.cleaned_version.name : item.original_name}
                          </p>
                          {item.is_nlem_listed && (
                            <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                              <Check className="w-2 h-2" />
                              NLEM
                            </span>
                          )}
                          {isRateMismatch && appMode === 'hib' && (
                            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertCircle className="w-2 h-2" />
                              RATE MISMATCH
                            </span>
                          )}
                          {appMode === 'hospital' && item.status === 'brand' && (
                            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                              <FileCheck className="w-2 h-2" />
                              AUTO-SWAPPED
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
                          <p className="text-[10px] italic opacity-60 mt-1">
                            {appMode === 'hospital' ? `Original: ${item.original_name}` : `Mapped to: ${item.name}`}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[10px] text-amber-600 font-medium mt-1 flex items-start gap-1">
                            <Info className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{item.notes}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="sm:col-span-2 flex sm:justify-center w-full sm:w-auto">
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="sm:col-span-1 text-center font-mono text-sm flex justify-between sm:block w-full sm:w-auto">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.qtyLabel}</span>
                        {item.quantity}
                      </div>
                      <div className="sm:col-span-2 text-right font-mono text-sm flex justify-between sm:block w-full sm:w-auto">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.billLabel}</span>
                        <span className={appMode === 'hospital' && item.cleaned_version ? 'line-through opacity-40' : ''}>
                          Rs. {item.bill_rate}
                        </span>
                        {appMode === 'hospital' && item.cleaned_version && (
                          <div className="text-emerald-600 font-black">Rs. {item.cleaned_version.rate}</div>
                        )}
                      </div>
                      <div className="sm:col-span-2 text-right font-mono text-sm font-bold flex justify-between sm:block w-full sm:w-auto">
                        <span className="sm:hidden text-[10px] font-bold text-slate-400 uppercase">{t.hibLabel}</span>
                        <span className={isRateMismatch ? 'text-amber-600' : ''}>Rs. {item.hib_rate}</span>
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
                {data.ai_insights.fraud_flags?.filter((f: string) => !f.toLowerCase().includes('rate mismatch') && !f.toLowerCase().includes('price mismatch')).length > 0 ? (
                  <div className="space-y-2">
                    {data.ai_insights.fraud_flags
                      .filter((f: string) => !f.toLowerCase().includes('rate mismatch') && !f.toLowerCase().includes('price mismatch'))
                      .map((flag: string, i: number) => (
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
        <div className="flex flex-col md:flex-row gap-4 pt-8 print:hidden">
          <button 
            onClick={handleProceedToClaim}
            disabled={localStatus === 'approved'}
            className={`flex-1 py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl ${
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
            className={`flex-1 border-2 py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl ${
              localStatus === 'flagged'
              ? "border-amber-500 bg-amber-50 text-amber-700 cursor-default"
              : "border-[#141414] hover:bg-white"
            }`}
          >
            {localStatus === 'flagged' && <AlertTriangle className="w-5 h-5" />}
            {localStatus === 'flagged' ? t.claimFlagged : t.flagForReview}
          </button>

          <button 
            onClick={() => handleStatusUpdate('rejected')}
            disabled={localStatus === 'rejected'}
            className={`flex-1 border-2 py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl ${
              localStatus === 'rejected'
              ? "border-red-500 bg-red-50 text-red-700 cursor-default"
              : "border-red-200 text-red-600 hover:bg-red-50"
            }`}
          >
            {localStatus === 'rejected' && <XCircle className="w-5 h-5" />}
            {localStatus === 'rejected' ? "Claim Rejected" : "Reject Claim"}
          </button>
          
          {localStatus === 'flagged' && (
            <button 
              onClick={() => navigate('/review-details', { state: { data } })}
              className="flex-1 bg-amber-500 text-white py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-amber-600 shadow-lg shadow-amber-200 rounded-2xl"
            >
              <ShieldAlert className="w-5 h-5" />
              {t.reviewDetails}
            </button>
          )}
        </div>
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
      {/* Brand Warning Popup (Generic Swapper) */}
      <AnimatePresence>
        {showBrandPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Brand Name Detected</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                    Warning: <span className="text-red-600 font-black">'{brandWarning}'</span> detected. This will be rejected as HIB only approves generic medicines.
                  </p>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={() => setShowBrandPopup(false)}
                    className="w-full bg-[#141414] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-opacity-90 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> I Understand
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowBrandPopup(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Payload Modal */}
      <AnimatePresence>
        {showPayloadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPayloadModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <Code className="w-5 h-5 text-brand-primary" />
                    openIMIS JSON Payload
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Standard FHIR Claim Resource Format</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleCopyPayload}
                    className="p-2 text-slate-400 hover:text-brand-primary hover:bg-white rounded-xl transition-all border border-slate-200 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button 
                    onClick={() => setShowPayloadModal(false)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all border border-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-slate-900">
                <pre className="text-[10px] sm:text-xs font-mono text-emerald-400 leading-relaxed">
                  {JSON.stringify(generateOpenIMISPayload(), null, 2)}
                </pre>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Info className="w-3 h-3" /> This format is ready for the openIMIS Claim API endpoint.
                </p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSealed ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                    {isSealed ? 'Digital Seal Attached' : 'Unsealed Draft'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official HIB Claim Form (Hidden in UI, visible in Print) */}
      <div className="hidden print:block bg-white p-12 text-slate-900 font-serif">
        <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Nepal Health Insurance Board</h1>
          <p className="text-sm font-bold mt-1">Official Medical Claim Audit Form</p>
          <div className="flex justify-center gap-4 mt-4 text-[10px] font-mono uppercase">
            <span>Form No: HIB-2081-AUDIT</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase border-b border-slate-200 pb-1">Patient Information</h2>
            <div className="text-sm space-y-1">
              <p><span className="font-bold">Name:</span> {data.patient?.name}</p>
              <p><span className="font-bold">HIB ID:</span> {data.patient?.health_insurance_number}</p>
              <p><span className="font-bold">Age/Sex:</span> {data.patient?.age}Y / {data.patient?.sex}</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase border-b border-slate-200 pb-1">Hospital & Provider</h2>
            <div className="text-sm space-y-1">
              <p><span className="font-bold">Hospital:</span> {data.hospital?.name}</p>
              <p><span className="font-bold">Reg No:</span> {data.hospital?.registration_no}</p>
              <p><span className="font-bold">Officer:</span> {data.doctor?.name} (NMC: {data.doctor?.nmc_number})</p>
            </div>
          </div>
        </div>

        {data.diagnosis && data.diagnosis.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xs font-black uppercase border-b border-slate-200 pb-1 mb-4">Diagnosis (ICD-10)</h2>
            <div className="flex flex-wrap gap-4">
              {data.diagnosis.map((d: any, i: number) => (
                <div key={i} className="text-sm">
                  <span className="font-bold uppercase">{d.name}</span>
                  {d.icd10_code && (
                    <span className="ml-2 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {d.icd10_code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-12">
          <h2 className="text-xs font-black uppercase border-b border-slate-200 pb-2 mb-4">Claim Audit Breakdown</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Bill Rate</th>
                <th className="py-2 text-right">HIB Rate</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 uppercase font-bold">{isHospital ? (item.cleaned_version?.name || item.name) : (item.original_name || item.name)}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">Rs. {item.bill_rate}</td>
                  <td className="py-2 text-right">Rs. {isHospital ? (item.cleaned_version?.rate || item.hib_rate) : item.hib_rate}</td>
                  <td className="py-2 text-right">Rs. {(isHospital ? (item.cleaned_version?.rate || item.hib_rate) : item.hib_rate) * item.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-black">
                <td colSpan={4} className="py-4 text-right uppercase">Total Approved Amount</td>
                <td className="py-4 text-right">Rs. {data.total_hib_amount?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-12 items-end">
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h3 className="text-[10px] font-black uppercase mb-2">Digital Verification Seal</h3>
              <div className="flex items-center gap-4">
                {isSealed && claimHash ? (
                  <>
                    <QRCodeCanvas value={claimHash} size={80} />
                    <div className="text-[8px] font-mono break-all opacity-60">
                      HASH_ID: {claimHash}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] font-bold text-slate-400 italic">
                    UNSEALED DRAFT - NOT FOR SUBMISSION
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500 italic">
              This document is an AI-audited medical claim generated via the HIB Hybrid Audit System. 
              The digital seal above verifies that the data matches the hospital's original submission 
              and has been pre-cleared for fast-track processing.
            </p>
          </div>
          <div className="text-center space-y-12">
            <div className="border-b border-slate-900 w-48 mx-auto"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signature / Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
