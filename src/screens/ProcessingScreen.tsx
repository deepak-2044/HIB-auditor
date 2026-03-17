import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, FileSearch, Database, CheckCircle, Zap } from 'lucide-react';
import { analyzeMedicalDocument } from '../services/geminiService';
import { crossReference } from '../utils/matchEngine';
import { saveToHistory } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';

export default function ProcessingScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { image, mimeType } = location.state || {};
  
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
        // Step 1: Extraction & Step 2: DB Lookup & Step 3: Clinical Auditing 
        // are now all handled inside analyzeMedicalDocument for tighter grounding
        const auditedData = await analyzeMedicalDocument(image, mimeType);
        
        setStep(4);
        
        // Save to history
        saveToHistory(auditedData);
        setResultData(auditedData);
        setStep(4);
        
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred during processing.");
      }
    };

    process();
  }, [image, mimeType, navigate]);

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
        <div className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4">{t.processingError}</h2>
          <p className="text-sm opacity-70 mb-8">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-bold uppercase tracking-widest"
          >
            {t.returnHome}
          </button>
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
