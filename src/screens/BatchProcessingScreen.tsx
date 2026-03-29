import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, FileSearch, Database, CheckCircle, Zap, Layers, AlertCircle } from 'lucide-react';
import { analyzeMedicalDocument } from '../services/geminiService';
import { saveToHistory } from '../utils/historyManager';
import { useLanguage } from '../utils/languageContext';

interface Claim {
  image: string;
  mimeType: string;
}

interface ProcessState {
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  data?: any;
}

export default function BatchProcessingScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { claims } = (location.state as { claims: Claim[] }) || { claims: [] };
  
  const [processStates, setProcessStates] = useState<ProcessState[]>(
    claims.map((_, i) => ({ index: i, status: 'pending' }))
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const processingRef = React.useRef(false);

  useEffect(() => {
    if (!claims || claims.length === 0) {
      navigate('/');
      return;
    }

    if (processingRef.current) return;
    processingRef.current = true;

    const processBatch = async () => {
      for (let i = 0; i < claims.length; i++) {
        setCurrentIdx(i);
        setProcessStates(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing' } : s));
        
        try {
          const auditedData = await analyzeMedicalDocument(claims[i].image, claims[i].mimeType);
          saveToHistory(auditedData);
          setProcessStates(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed', data: auditedData } : s));
          
          // Add a small delay between claims to avoid hitting RPM limits on free keys
          if (i < claims.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          console.error(`Error processing claim ${i}:`, err);
          setProcessStates(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error', error: err.message } : s));
        }
      }
    };

    processBatch();
  }, [claims, navigate]);

  const allDone = processStates.every(s => s.status === 'completed' || s.status === 'error');
  const completedCount = processStates.filter(s => s.status === 'completed').length;

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        navigate('/history');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allDone, navigate]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-2xl w-full space-y-8 sm:space-y-12">
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
            <Layers className="w-3 h-3" /> Batch Processing Mode
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif italic">Auditing {claims.length} Claims</h2>
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
            Processing {currentIdx + 1} of {claims.length} • {Math.round((completedCount / claims.length) * 100)}% Complete
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {processStates.map((state, i) => (
            <div 
              key={i}
              className={`flex items-center justify-between p-4 border transition-all duration-500 ${
                state.status === 'processing' 
                  ? "border-[#141414] bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] scale-[1.02]" 
                  : state.status === 'completed'
                    ? "border-emerald-600 bg-emerald-50 opacity-80" 
                    : state.status === 'error'
                      ? "border-red-600 bg-red-50"
                      : "border-transparent opacity-20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-xs">
                  {i + 1}
                </div>
                <div>
                  <p className="font-black uppercase text-[10px] tracking-widest">Claim Document {i + 1}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    {state.status === 'pending' && 'Waiting in queue...'}
                    {state.status === 'processing' && 'Analyzing with Google Intelligence...'}
                    {state.status === 'completed' && 'Audit Complete'}
                    {state.status === 'error' && `Error: ${state.error}`}
                  </p>
                </div>
              </div>
              
              <div>
                {state.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />}
                {state.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                {state.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              </div>
            </div>
          ))}
        </div>

        {allDone && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-600 text-white p-6 rounded-2xl text-center shadow-xl shadow-emerald-200"
          >
            <p className="text-sm font-black uppercase tracking-widest mb-1">Batch Audit Complete</p>
            <p className="text-[10px] opacity-80 uppercase font-bold">Redirecting to history to view all results...</p>
          </motion.div>
        )}

        <div className="bg-white border border-[#141414] p-4 font-mono text-[9px] sm:text-[10px] opacity-40 overflow-hidden">
          <div className="animate-pulse">
            {">"} BATCH_MODE_ENABLED: TRUE<br />
            {">"} QUEUE_SIZE: {claims.length}<br />
            {">"} PROCESSING_CLAIM_{currentIdx + 1}...<br />
            {">"} GROUNDING_WITH_GOOGLE_SEARCH...<br />
          </div>
        </div>
      </div>
    </div>
  );
}
