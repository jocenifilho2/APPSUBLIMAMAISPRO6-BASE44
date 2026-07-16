import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Isso aparece no console do navegador se esquecer de configurar
  // as variáveis de ambiente na Vercel (Settings → Environment Variables).
  console.error(
    'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas. ' +
    'Verifique as variáveis de ambiente do projeto na Vercel.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
