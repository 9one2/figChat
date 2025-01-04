/// <reference types="@figma/plugin-typings" />

console.log('Plugin code starting...');

// 기본 설정
figma.showUI(__html__, {
  width: 350,
  height: 500,
  themeColors: true
});

// Supabase 설정
const supabaseUrl = 'https://xpcihvmlbnfxsfnwfvta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwY2lodm1sYm5meHNmbndmdnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MTcyOTYsImV4cCI6MjA1MTQ5MzI5Nn0.VZVNPkdw5hS8RwJn5b0HAh-h1BFH1jvFmljQM_pqJ5Q';
const pluginId = '1457045351889106584';

// CORS 프록시 서버를 통한 API 호출
async function callSupabaseApi(endpoint: string, options: any = {}) {
    try {
        const targetUrl = `${supabaseUrl}/rest/v1/${endpoint}`;
        console.log('API 요청 URL:', targetUrl);
        
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'X-Client-Info': `figma-plugin/${pluginId}`
        };

        console.log('요청 헤더:', headers);
        
        const response = await fetch(targetUrl, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        console.log('응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 오류:', errorText);
            throw new Error(`API 오류: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('API 응답 데이터:', data);
        return { data, error: null };
    } catch (error: any) {
        console.error('API 호출 실패:', error);
        return { data: null, error: error.message };
    }
}

// URL 파라미터 생성 함수
function buildQueryString(params: Record<string, any>): string {
    return Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}

// 테스트용 채팅방 생성 함수
async function createTestChatRoom() {
    try {
        const response = await callSupabaseApi('chatRooms', {
            method: 'POST',
            body: JSON.stringify({
                name: '테스트 채팅방',
                created_at: new Date().toISOString()
            })
        });

        console.log('테스트 채팅방 생성 결과:', response);
        return response;
    } catch (error) {
        console.error('테스트 채팅방 생성 실패:', error);
        return { data: null, error };
    }
}

// UI로부터의 메시지 수신
figma.ui.onmessage = async msg => {
    console.log('플러그인이 UI로부터 메시지 수신:', msg);
    
    if (msg.type === 'supabase-request') {
        const { table, method, params, body } = msg;
        
        try {
            // 채팅방이 없을 경우 테스트 데이터 생성
            if (msg.action === 'getChatRooms') {
                const testResponse = await callSupabaseApi('chatRooms', {
                    method: 'GET'
                });
                
                if (testResponse.data && testResponse.data.length === 0) {
                    console.log('채팅방이 없습니다. 테스트 데이터를 생성합니다.');
                    await createTestChatRoom();
                }
            }

            let endpoint = table;
            if (params) {
                const queryString = buildQueryString(params);
                endpoint = `${table}?${queryString}`;
            }

            const response = await callSupabaseApi(endpoint, {
                method: method || 'GET',
                body: body ? JSON.stringify(body) : undefined
            });

            figma.ui.postMessage({
                type: 'supabase-response',
                action: msg.action,
                result: response
            });
        } catch (error: any) {
            figma.ui.postMessage({
                type: 'supabase-response',
                action: msg.action,
                result: { data: null, error: error.message }
            });
        }
    }
};

// 플러그인 초기화 완료 알림
figma.ui.postMessage({
    type: 'plugin-ready',
    text: '플러그인 초기화 완료'
});
