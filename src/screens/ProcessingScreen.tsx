import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, FileSearch, Database, CheckCircle, Zap, ShieldAlert } from 'lucide-react';
import { analyzeMedicalDocument } from '../services/geminiService';
import { saveToHistory } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';

export default function ProcessingScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { image, mimeType } = location.state || {};
  
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isKeyError, setIsKeyError] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const processingRef = React.useRef(false);

  const steps = [
    { label: t.initializing, icon: <Loader2 className="w-5 h-5 animate-spin" /> },
    { label: t.extracting, icon: <FileSearch className="w-5 h-5" /> },
    { label: t.crossReferencing, icon: <Database className="w-5 h-5" /> },
    { label: t.medicalConsistencyCheck, icon: <Zap className="w-5 h-5" /> },
    { label: t.finalizing, icon: <CheckCircle className="w-5 h-5" /> }
  ];

  useEffect(() => {
    if (!image) {
      navigate('/');
      return;
    }

    if (processingRef.current) return;
    processingRef.current = true;

    const process = async () => {
      try {
        setStep(1);
        const auditedData = await analyzeMedicalDocument(image, mimeType);
        
        setStep(4);
        saveToHistory(auditedData);
        setResultData(auditedData);
        
      } catch (err: any) {
        console.error(err);
        let msg = err.message || "An error occurred during processing.";
        
        if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('key is missing')) {
          setIsKeyError(true);
        }

        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          msg = "GOOGLE QUOTA EXCEEDED: You are using a free Gemini API key which has strict rate limits. If you haven't used it recently, your key might be restricted or disabled by Google. Please check your key status at aistudio.google.com.";
        }
        setError(msg);
      }
    };

    process();
  }, [image, mimeType, navigate]);

  const handleConnectKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // Force a full reload to the home page to ensure the new key is used
      window.location.href = '/';
    } else {
      navigate('/settings');
    }
  };

  useEffect(() => {
    if (step === 4 && resultData) {
      const timer = setTimeout(() => {
        navigate('/results', { state: { data: resultData } });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resultData, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className={`w-16 h-16 ${isKeyError ? 'bg-brand-primary/10' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {isKeyError ? <ShieldAlert className="w-8 h-8 text-brand-primary" /> : <Loader2 className="w-8 h-8 text-red-600" />}
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4 text-center">
            {isKeyError ? "Connection Required" : t.processingError}
          </h2>
          
          <div className={`${isKeyError ? 'bg-brand-primary/5 border-brand-primary/10' : 'bg-red-50 border-red-100'} border p-4 rounded-xl mb-8`}>
            <p className={`text-xs ${isKeyError ? 'text-brand-primary' : 'text-red-800'} font-medium leading-relaxed`}>
              {error}
            </p>
          </div>

          <div className="space-y-3">
            {isKeyError ? (
              <button 
                onClick={handleConnectKey}
                className="w-full bg-brand-primary text-white py-4 font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-brand-primary/20"
              >
                Connect Gemini Key
              </button>
            ) : (
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Try Again
              </button>
            )}
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-white text-[#141414] border border-[#141414] py-4 font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              {t.returnHome}
            </button>
          </div>
          
          {!isKeyError && (
            <p className="mt-6 text-[10px] text-slate-400 text-center uppercase font-bold">
              Tip: If you are on the free tier, wait 60 seconds between scans.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full space-y-8 sm:space-y-12">
        <div className="text-center space-y-3 sm:space-y-4">
          <h2 className="text-3xl sm:text-4xl font-serif italic">{t.auditing}</h2>
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">{t.analysisInProgress}</p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {steps.map((s, i) => (
            <div 
              key={i}
              className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border transition-all duration-500 ${
                step === i 
                  ? "border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] scale-[1.02] sm:scale-105" 
                  : step > i 
                    ? "border-emerald-600 bg-emerald-50 opacity-60" 
                    : "border-transparent opacity-20"
              }`}
            >
              <div className={step === i ? "text-[#141414]" : step > i ? "text-emerald-600" : ""}>
                {step > i ? <CheckCircle className="w-5 h-5" /> : s.icon}
              </div>
              <span className={`font-bold uppercase text-[10px] sm:text-xs tracking-widest ${step === i ? "text-[#141414]" : ""}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#141414] p-4 font-mono text-[9px] sm:text-[10px] opacity-40 overflow-hidden">
          <div className="animate-pulse">
            {">"} INITIALIZING GEMINI-3-FLASH...<br />
            {">"} LOADING HIB_2081_PRICELIST.DB...<br />
            {">"} SCANNING FOR PATIENT_ID...<br />
            {step >= 1 && <>{">"} EXTRACTING ENTITIES FROM IMAGE...<br /></>}
            {step >= 2 && <>{">"} MATCHING CODES: [MED, LAB, RAD]...<br /></>}
          </div>
        </div>
      </div>
    </div>
  );
}
