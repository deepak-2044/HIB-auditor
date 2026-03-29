import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  localStorage.getItem('HIB_SUPABASE_URL') || 
  import.meta.env.VITE_SUPABASE_URL || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  '';

const supabaseAnonKey = 
  localStorage.getItem('HIB_SUPABASE_ANON_KEY') || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn('Supabase configuration is missing or invalid. Cloud database features will be disabled.');
}

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !supabaseUrl.includes('placeholder');
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
