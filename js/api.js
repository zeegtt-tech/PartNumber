// js/api.js
const SUPABASE_URL = 'https://lmzwttsgbklrkzlyztid.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MLyhf-duOhGCD066RvFC6Q_DJr1yHvo';

// Exportamos o cliente para ser usado no state.js
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);