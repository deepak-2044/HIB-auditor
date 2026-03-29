import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Camera, FileText, CheckCircle2, AlertCircle, Info, Clock, Languages, Beaker, Database, Zap, Settings, X, Key, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../utils/languageContext';
import { supabase } from '../utils/supabase';
import { hasValidApiKey } from '../services/geminiService';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const check1 = supabase.from('hib_items').select('count', { count: 'exact', head: true });
        const check2 = supabase.from('health_insurance_benefits').select('count', { count: 'exact', head: true });
        const check3 = supabase.from('health_insurance_benefit').select('count', { count: 'exact', head: true });
        
        const results = await Promise.allSettled([check1, check2, check3]);
        const anySuccess = results.some(r => r.status === 'fulfilled' && !(r as any).value.error);
        
        setDbStatus(anySuccess ? 'connected' : 'error');
      } catch (e) {
        setDbStatus('error');
      }
    };

    const checkApi = async () => {
      const valid = await hasValidApiKey();
      setHasApiKey(valid);
    };
    
    checkDb();
    checkApi();

    // If check hangs, show the banner after 5 seconds
    const timer = setTimeout(() => {
      setHasApiKey(prev => prev === null ? false : prev);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleConnectKey = async () => {
    // Clear any old/expired key from localStorage first
    localStorage.removeItem('HIB_GEMINI_API_KEY');
    
    if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // Force a full reload to ensure the new key is detected
      window.location.reload();
    } else {
      navigate('/settings');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    const filePromises = Array.from(files).map(file => {
      return new Promise<{ image: string, mimeType: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ 
            image: reader.result as string, 
            mimeType: (file as File).type 
          });
        };
        reader.readAsDataURL(file as File);
      });
    });

    const results = await Promise.all(filePromises);
    
    if (results.length > 1) {
      navigate('/batch-processing', { state: { claims: results } });
    } else {
      navigate('/processing', { state: { image: results[0].image, mimeType: results[0].mimeType } });
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-[#1E293B] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-4 sm:p-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase text-brand-primary">{t.appName}</h1>
            <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 tracking-widest uppercase">V2081.2</p>
          </div>
          
          {/* Language Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${language === 'en' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ne')}
              className={`px-2 py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${language === 'ne' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400'}`}
            >
              NE
            </button>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-4">
          {/* AI Status Indicator - Always visible on mobile */}
          <div className="flex flex-col items-end justify-center px-3 border-r border-slate-200 mr-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">AI Status</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-emerald-500' : hasApiKey === false ? 'bg-amber-500' : 'bg-slate-300 animate-pulse'}`}></div>
              <span className={`text-[10px] font-bold uppercase ${hasApiKey ? 'text-emerald-600' : hasApiKey === false ? 'text-amber-600' : 'text-slate-400'}`}>
                {hasApiKey ? 'Ready' : hasApiKey === false ? 'Key Req' : 'Checking'}
              </span>
            </div>
          </div>

          <button 
            onClick={() => navigate('/settings')}
            className="p-2 bg-slate-100 text-brand-primary rounded-lg hover:bg-slate-200 transition-all border border-brand-primary/20"
            title="App Settings"
          >
            <Key className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold uppercase text-[8px] sm:text-[10px] tracking-widest hover:bg-slate-200 transition-all"
          >
            <Clock className="w-3 h-3" /> <span className="hidden xs:inline">{t.auditHistory}</span><span className="xs:hidden">History</span>
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono opacity-50 uppercase">DB: {dbStatus === 'connected' ? 'HIB_ITEMS' : 'OFFLINE'}</p>
            <p className={`text-xs font-bold flex items-center gap-1 justify-end ${dbStatus === 'connected' ? 'text-emerald-500' : dbStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-slate-400 animate-pulse'}`}></span>
              {dbStatus === 'connected' ? 'CONNECTED' : dbStatus === 'error' ? 'CONFIG REQ' : 'CHECKING...'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        {/* Database Connection Banner - For Remixed Apps */}
        <AnimatePresence>
          {dbStatus === 'error' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-amber-600 p-6 rounded-[2rem] shadow-2xl shadow-amber-200 flex flex-col md:flex-row items-center justify-between gap-6 border-4 border-amber-400/30"
            >
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shrink-0 -rotate-3">
                  <Database className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tighter text-white text-xl mb-1">Database Offline</h4>
                  <p className="text-sm text-amber-50 font-medium max-w-md leading-tight">
                    Since this is a remixed app, you may need to configure your own Supabase database in Settings to store and retrieve HIB rates.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/settings')}
                className="w-full md:w-auto px-12 py-4 bg-white text-amber-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                Fix Database
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* API Key Connection Banner - High Visibility */}
        <AnimatePresence>
          {hasApiKey === false && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 bg-blue-600 p-6 rounded-[2rem] shadow-2xl shadow-blue-200 flex flex-col md:flex-row items-center justify-between gap-6 border-4 border-blue-400/30"
            >
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shrink-0 rotate-3">
                  <Key className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tighter text-white text-xl mb-1">AI Connection Required</h4>
                  <p className="text-sm text-blue-50 font-medium max-w-md leading-tight">
                    To use AI features, you must connect your Gemini API key. This is the most secure way to link your Google account.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleConnectKey}
                className="w-full md:w-auto px-12 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                Connect Now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-8 lg:py-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-7 space-y-6 sm:space-y-8"
          >
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block">{t.aiPowered}</span>
                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Google Intelligence</span>
                </div>
              </div>
              <h2 className="text-4xl sm:text-6xl font-black leading-[0.9] tracking-tighter text-slate-900 uppercase">
              {t.automated} <br />
              <span className="text-brand-primary">Claim</span> <br />
              Auditor
            </h2>
            </div>
            
            <p className="text-lg sm:text-xl text-slate-500 font-medium leading-relaxed max-w-xl">
              {t.heroDescription} Now supports batch processing—upload up to 5 claims at once for rapid auditing.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-2 sm:pt-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand-primary text-white px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-4 group hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand-primary/20"
              >
                <span className="font-black uppercase tracking-widest text-base sm:text-lg">{t.analyzeNew}</span>
                <Upload className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-y-[-2px] transition-transform" />
              </button>
              
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="bg-white text-brand-primary border-2 border-brand-primary px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-4 group hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
              >
                <span className="font-black uppercase tracking-widest text-base sm:text-lg">{(t as any).takePicture}</span>
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform" />
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
                multiple
              />
              <input 
                type="file" 
                ref={cameraInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
                capture="environment"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.supportedFiles}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-100"
          >
            <h3 className="font-black text-xs uppercase mb-6 sm:mb-8 text-slate-400 tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4" /> {t.auditLegend}
            </h3>
            <div className="space-y-6 sm:space-y-8">
              <div className="flex gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase text-slate-800">{t.hibListed}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{t.hibListedDesc}</p>
                </div>
              </div>
              
              <div className="flex gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase text-slate-800">{t.brandMapping}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{t.brandMappingDesc}</p>
                </div>
              </div>

              <div className="flex gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase text-slate-800">{t.notFound}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{t.notFoundDesc}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="border-t border-slate-200 pt-8 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-60">
          <div>
            <p className="text-[10px] font-mono uppercase font-bold mb-2">{t.security}</p>
            <p className="text-xs">{t.securityDesc}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase font-bold mb-2">{t.compliance}</p>
            <p className="text-xs">{t.complianceDesc}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase font-bold mb-2">{t.support}</p>
            <p className="text-xs mb-2">{t.supportDesc}</p>
            <button 
              onClick={() => navigate('/settings')}
              className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:underline"
            >
              Open System Settings →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
