import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { checkSupabaseConnection } from './supabase';

interface User {
    id: string;
    nickname: string;
    avatar_url?: string;
    created_at?: string;
}

interface ChatRoom {
    id: string;
    name: string;
    created_by: string;
    created_at?: string;
}

interface Message {
    id: string;
    chat_room_id: string;
    user_id: string;
    content: string;
    image_url?: string;
    created_at?: string;
}

// null로 초기화하여 타입 안전성 확보
let currentUserId: string | null = null;
let currentUser: User | null = null;
let currentChatRoom: ChatRoom | null = null;

// updateStatus 함수를 전역으로 이동
function updateStatus(message: string, isError = false) {
    console.log(message);
    const statusDiv = document.getElementById('status');
    const messageList = document.getElementById('messageList');
    
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.backgroundColor = isError ? '#ffe6e6' : '#f0f0f0';
    }
    if (messageList) {
        messageList.innerHTML += `<div class="system-message">${message}</div>`;
    }
}

// 메시지 표시 함수
async function displayMessage(message: Message) {
    const messageList = document.getElementById('messageList');
    if (!messageList || !currentUserId) return;

    // 사용자 정보 가져오기 - 메인 스레드를 통해 요청
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'getUser',
            table: 'users',
            method: 'GET',
            params: { id: message.user_id }
        }
    }, '*');

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.user_id === currentUserId ? 'sent' : 'received'}`;
    
    const nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'nickname';
    nicknameSpan.textContent = '알 수 없음';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.textContent = message.content;

    if (message.image_url) {
        const imageElement = document.createElement('img');
        imageElement.src = message.image_url;
        imageElement.className = 'message-image';
        contentDiv.appendChild(imageElement);
    }

    messageElement.appendChild(nicknameSpan);
    messageElement.appendChild(contentDiv);
    messageList.appendChild(messageElement);
    messageList.scrollTop = messageList.scrollHeight;
}

// 사용자 생성 함수
async function createUser(nickname: string): Promise<User | null> {
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'createUser',
            table: 'users',
            method: 'POST',
            body: { nickname }
        }
    }, '*');
    return null; // 응답은 onmessage 이벤트에서 처리
}

// 채팅방 생성 함수
async function createChatRoom(name: string): Promise<ChatRoom | null> {
    if (!currentUserId) return null;
    
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'createChatRoom',
            table: 'chatRooms',
            method: 'POST',
            body: {
                name,
                created_by: currentUserId
            }
        }
    }, '*');
    return null; // 응답은 onmessage 이벤트에서 처리
}

// 메시지 전송 함수
async function sendMessage(content: string) {
    if (!currentChatRoom || !currentUserId) return;
    
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'sendMessage',
            table: 'messages',
            method: 'POST',
            body: {
                chat_room_id: currentChatRoom.id,
                user_id: currentUserId,
                content
            }
        }
    }, '*');
}

// 메시지 구독 설정
function subscribeToMessages() {
    if (!currentChatRoom) return;

    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'subscribeToMessages',
            table: 'messages',
            params: {
                chatRoomId: currentChatRoom.id
            }
        }
    }, '*');
}

// 이전 메시지 로드
async function loadMessages() {
    if (!currentChatRoom) return;
    
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'loadMessages',
            table: 'messages',
            method: 'GET',
            params: {
                chat_room_id: currentChatRoom.id,
                limit: 50
            }
        }
    }, '*');
}

// 초기화 함수
async function initializeApp() {
    try {
        updateStatus('앱 초기화 시작...');
        
        // Supabase API 요청
        parent.postMessage({
            pluginMessage: {
                type: 'supabase-request',
                action: 'getChatRooms',
                table: 'chatRooms',
                method: 'GET',
                params: {
                    select: '*',
                    order: 'created_at.desc'
                }
            }
        }, '*');

        // 응답 리스너 설정
        window.onmessage = async (event) => {
            const msg = event.data.pluginMessage;
            if (!msg) return;

            console.log('받은 메시지:', msg);

            if (msg.type === 'supabase-response') {
                console.log('Supabase 응답:', msg);
                
                if (msg.action === 'getChatRooms') {
                    const { result } = msg;
                    if (result.error) {
                        updateStatus('채팅방 목록 가져오기 실패: ' + result.error, true);
                        return;
                    }

                    const rooms = result.data;
                    if (!Array.isArray(rooms)) {
                        updateStatus('잘못된 응답 형식', true);
                        return;
                    }

                    updateStatus(`${rooms.length}개의 채팅방을 찾았습니다.`);

                    // 채팅방 목록 표시
                    const messageList = document.getElementById('messageList');
                    if (messageList && rooms.length > 0) {
                        messageList.innerHTML = `
                            <div class="chat-rooms">
                                <h3>사용 가능한 채팅방</h3>
                                ${rooms.map((room: ChatRoom) => `
                                    <div class="chat-room-item" data-room-id="${room.id}">
                                        ${room.name}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                }
            }
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        updateStatus('오류: ' + errorMessage, true);
        console.error('초기화 오류:', error);
    }
}

// UI 이벤트 설정
function setupUIEvents() {
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;
    const sendButton = document.getElementById('sendButton');

    if (sendButton && messageInput) {
        sendButton.onclick = () => {
            const content = messageInput.value.trim();
            if (content) {
                sendMessage(content);
                messageInput.value = '';
            }
        };

        messageInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
            }
        };
    }
}

// UI 스타일 추가
const style = document.createElement('style');
style.textContent = `
    .chat-rooms {
        padding: 10px;
    }
    .chat-room-item {
        padding: 8px;
        margin: 4px 0;
        background: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
    }
    .chat-room-item:hover {
        background: #e3f2fd;
    }
    .system-message {
        color: #666;
        font-size: 12px;
        text-align: center;
        padding: 4px;
        margin: 4px 0;
    }
`;
document.head.appendChild(style);

// DOM이 완전히 로드된 후 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드됨');
    // 약간의 지연을 주어 iframe이 완전히 초기화되도록 함
    setTimeout(() => {
        console.log('초기화 시작');
        initializeApp().catch(error => {
            console.error('초기화 중 오류 발생:', error);
        });
    }, 100);
});

// window onload 이벤트도 바인딩
window.onload = () => {
    console.log('Window 로드 완료');
};

