import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://xpcihvmlbnfxsfnwfvta.supabase.co'
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwY2lodm1sYm5meHNmbndmdnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MTcyOTYsImV4cCI6MjA1MTQ5MzI5Nn0.VZVNPkdw5hS8RwJn5b0HAh-h1BFH1jvFmljQM_pqJ5Q'

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: window.localStorage
    },
    global: {
        headers: {
            'X-Client-Info': 'figma-plugin/1457045351889106584'
        }
    }
})

export async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('chatRooms')
            .select('*')
            .limit(1);

        if (error) throw error;
        console.log('Supabase 연결 성공:', data);
        return true;
    } catch (error) {
        console.error('Supabase 연결 확인 중 오류:', error);
        return false;
    }
} 