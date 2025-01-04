export {};

/// <reference types="@figma/plugin-typings" />

console.log('플러그인 코드 시작...');

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

let lastMessageTime = new Date().toISOString();
let messagePollingInterval: any = null;

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

// Supabase 실시간 구독 설정
async function setupRealtimeSubscription(roomId: string) {
    try {
        // 이전 폴링 정리
        if (messagePollingInterval) {
            clearInterval(messagePollingInterval);
        }

        // 초기 메시지 로드
        const response = await callSupabaseApi(`messages?chat_room_id=eq.${roomId}&order=created_at.asc`, {
            headers: {
                'Prefer': 'return=representation'
            }
        });

        if (response.data) {
            figma.ui.postMessage({
                type: 'new-messages',
                messages: response.data
            });
            
            if (response.data.length > 0) {
                lastMessageTime = response.data[response.data.length - 1].created_at;
            }
        }

        // 실시간 업데이트 설정
        messagePollingInterval = setInterval(async () => {
            try {
                // ISO 8601 형식으로 타임스탬프 인코딩
                const encodedTime = encodeURIComponent(lastMessageTime);
                
                const newMessages = await callSupabaseApi(
                    `messages?chat_room_id=eq.${roomId}&created_at=gt.${encodedTime}`,
                    {
                        headers: {
                            'Prefer': 'return=representation'
                        }
                    }
                );

                if (newMessages.data && newMessages.data.length > 0) {
                    console.log('새 메시지 발견:', newMessages.data);
                    figma.ui.postMessage({
                        type: 'new-messages',
                        messages: newMessages.data
                    });
                    lastMessageTime = newMessages.data[newMessages.data.length - 1].created_at;
                }
            } catch (error) {
                console.error('새 메시지 확인 중 오류:', error);
            }
        }, 2000);

        return response;
    } catch (error) {
        console.error('실시간 구독 설정 실패:', error);
        return { data: null, error };
    }
}

// 메덤 유저 ID 생성 함수 수정 (UUID v4 형식)
function generateRandomUserId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 사용자 생성 함수 수정
async function createUser(userId: string) {
    try {
        const userData = {
            id: userId,
            nickname: `사용자_${userId.slice(0, 4)}`,
            created_at: new Date().toISOString()
        };

        const response = await callSupabaseApi('Users', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(userData)
        });

        return response;
    } catch (error) {
        console.error('사용자 생성 실패:', error);
        throw error;
    }
}

// 채팅방 생성 함수 수정
async function createChatRoom(name: string) {
    try {
        const response = await callSupabaseApi('Chatrooms', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name: name,
                created_at: new Date().toISOString()
            })
        });

        if (response.data) {
            // 채팅방 생성 후 멤버 추가
            await addChatRoomMember(response.data.id, currentUserId);
        }

        return response;
    } catch (error) {
        console.error('채팅방 생성 실패:', error);
        throw error;
    }
}

async function addChatRoomMember(roomId: string, userId: string) {
    try {
        return await callSupabaseApi('ChatRoomMembers', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name: userId,
                extra_info: roomId,
                created_at: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('채팅방 멤버 추가 실패:', error);
        throw error;
    }
}

// 플러그인 초기화 시 기본 채팅방 생성
async function initializePlugin() {
    try {
        // 1. 사용자 생성
        const userId = generateRandomUserId();
        await createUser(userId);

        // 2. 채팅방 목록 확인
        const roomsResponse = await callSupabaseApi('ChatRooms', {
            method: 'GET',
            headers: {
                'Prefer': 'return=representation'
            }
        });

        // 채팅방이 없으면 기본 채팅방 생성
        if (!roomsResponse.data || roomsResponse.data.length === 0) {
            await createChatRoom('일반 채팅방');
        }

        // 3. 초기화 완료 알림
        figma.ui.postMessage({
            type: 'plugin-ready',
            text: '플러그인 초기화 완료',
            userId: userId
        });

        return userId;
    } catch (error) {
        console.error('플러그인 초기화 실패:', error);
        throw error;
    }
}

// 플러그인 시작 시 초기화 실행
const currentUserId = await initializePlugin();

// 메시지 핸들러 수정
figma.ui.onmessage = async (msg) => {
    console.log('플러그인이 UI로부터 메시지 수신:', msg);
    
    switch (msg.type) {
        case 'get-user-id':
            figma.ui.postMessage({
                type: 'set-user-id',
                userId: currentUserId
            });
            break;

        case 'supabase-request':
            switch (msg.action) {
                case 'getChatRooms':
                    try {
                        const response = await callSupabaseApi('ChatRooms', {
                            method: 'GET',
                            headers: {
                                'Prefer': 'return=representation'
                            }
                        });
                        
                        console.log('채팅방 목록 응답:', response);
                        
                        figma.ui.postMessage({
                            type: 'supabase-response',
                            action: 'getChatRooms',
                            result: response
                        });
                    } catch (error) {
                        console.error('채팅방 목록 조회 실패:', error);
                        figma.ui.postMessage({
                            type: 'error',
                            error: error instanceof Error ? error.message : '채팅방 목록 조회 실패'
                        });
                    }
                    break;

                case 'loadMessages':
                    try {
                        const response = await callSupabaseApi(
                            `Messages?chat_room_id=eq.${msg.params.chat_room_id}&order=created_at.asc`,
                            { method: 'GET' }
                        );
                        
                        figma.ui.postMessage({
                            type: 'new-messages',
                            messages: response.data
                        });
                    } catch (error) {
                        console.error('메시지 로드 실패:', error);
                        figma.ui.postMessage({
                            type: 'error',
                            error: error instanceof Error ? error.message : '메시지 로드 실패'
                        });
                    }
                    break;
            }
            break;

        case 'send-message':
            try {
                const response = await sendMessage(msg.roomId, msg.content, currentUserId);
                if (response.error) {
                    throw new Error(response.error);
                }
                // 메시지 전송 성공 시 UI에 알림
                figma.ui.postMessage({
                    type: 'new-messages',
                    messages: [response.data[0]]  // 새로 생성된 메시지를 UI에 전달
                });
            } catch (error) {
                console.error('메시지 전송 실패:', error);
                figma.ui.postMessage({
                    type: 'error',
                    error: error instanceof Error ? error.message : '메시지 전송 실패'
                });
            }
            break;
    }
};

// 플러그인 초기화 완료 알림
figma.ui.postMessage({
    type: 'plugin-ready',
    text: '플러그인 초기화 완료',
    userId: currentUserId
});

// 메시지 전송 함수 수정
async function sendMessage(roomId: string, content: string, userId: string) {
    try {
        console.log('메시지 전송 시작:', { roomId, content, userId });
        
        const messageData = {
            chat_room_id: roomId,
            user_id: userId,
            content: content,
            created_at: new Date().toISOString()
        };
        
        const response = await callSupabaseApi('Messages', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(messageData)
        });

        if (response.error) {
            throw new Error(`메시지 전송 실패: ${response.error}`);
        }

        return response;
    } catch (error) {
        console.error('메시지 전송 실패:', error);
        throw error;
    }
}
