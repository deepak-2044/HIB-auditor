import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Key, Save, ArrowLeft, ShieldCheck, Database, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { clearApiKey } from '../services/geminiService';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [tempApiKey, setTempApiKey] = useState(localStorage.getItem('HIB_GEMINI_API_KEY') || '');
  const [tempDbUrl, setTempDbUrl] = useState(localStorage.getItem('HIB_SUPABASE_URL') || '');
  const [tempDbKey, setTempDbKey] = useState(localStorage.getItem('HIB_SUPABASE_ANON_KEY') || '');
  const [saved, setSaved] = useState(false);

  const clearAll = () => {
    if (window.confirm("Are you sure you want to clear all manual settings? This will restore default environment values.")) {
      clearApiKey();
      localStorage.removeItem('HIB_SUPABASE_URL');
      localStorage.removeItem('HIB_SUPABASE_ANON_KEY');
      setTempApiKey('');
      setTempDbUrl('');
      setTempDbKey('');
      window.location.reload();
    }
  };

  const saveSettings = () => {
    // Save Gemini Key
    if (tempApiKey.trim()) {
      localStorage.setItem('HIB_GEMINI_API_KEY', tempApiKey.trim());
    } else {
      localStorage.removeItem('HIB_GEMINI_API_KEY');
    }

    // Save Supabase URL
    if (tempDbUrl.trim()) {
      localStorage.setItem('HIB_SUPABASE_URL', tempDbUrl.trim());
    } else {
      localStorage.removeItem('HIB_SUPABASE_URL');
    }

    // Save Supabase Key
    if (tempDbKey.trim()) {
      localStorage.setItem('HIB_SUPABASE_ANON_KEY', tempDbKey.trim());
    } else {
      localStorage.removeItem('HIB_SUPABASE_ANON_KEY');
    }

    setSaved(true);
    setTimeout(() => {
      navigate('/');
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200 border border-slate-100"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
            <Settings className="w-8 h-8 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900">System Settings</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manual API Configuration</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-brand-primary/5 border border-brand-primary/10 p-6 rounded-2xl flex gap-4">
            <ShieldCheck className="w-6 h-6 text-brand-primary shrink-0" />
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Use this page to manually override your <strong>AI & Database</strong> settings. These local values will be saved in your browser's memory.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Key className="w-4 h-4" /> Gemini API Key <span className="text-brand-primary/40">(VITE_GEMINI_API_KEY)</span>
              </label>
              <input 
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Paste your Gemini API key..."
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Database className="w-4 h-4" /> Supabase URL <span className="text-brand-primary/40">(VITE_SUPABASE_URL)</span>
              </label>
              <input 
                type="text"
                value={tempDbUrl}
                onChange={(e) => setTempDbUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Key className="w-4 h-4" /> Supabase Anon Key <span className="text-brand-primary/40">(VITE_SUPABASE_ANON_KEY)</span>
              </label>
              <input 
                type="password"
                value={tempDbKey}
                onChange={(e) => setTempDbKey(e.target.value)}
                placeholder="Paste your Supabase anon key..."
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={saveSettings}
              disabled={saved}
              className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black uppercase tracking-widest text-base transition-all shadow-xl ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:scale-[1.02] active:scale-[0.98] shadow-brand-primary/20'}`}
            >
              {saved ? 'Settings Saved!' : <><Save className="w-5 h-5" /> Save & Apply</>}
            </button>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black uppercase tracking-widest text-base text-slate-400 hover:text-slate-600 transition-all"
            >
              <ArrowLeft className="w-5 h-5" /> Cancel & Return
            </button>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Deployment Guide</h4>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Set your <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in the AI Studio <strong>Secrets</strong> panel.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Click the <strong>Share</strong> button at the top of AI Studio to deploy your app to a public URL.
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={clearAll}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] text-red-400 hover:text-red-600 transition-all opacity-50 hover:opacity-100 mt-4"
            >
              <Trash2 className="w-3 h-3" /> Clear All Manual Settings
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
