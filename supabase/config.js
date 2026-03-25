// supabase/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://iickvzkkradmmwncogru.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wxVKHpOV4-IYjLFSQxfiBw_JJ6Cohn6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
