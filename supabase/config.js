// supabase/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wneijebgjzmgixvdqpa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_S6CcjLcaraiXPSI7TYLHQA_ZQLLJG1_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
