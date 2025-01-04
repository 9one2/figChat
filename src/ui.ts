import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { checkSupabaseConnection } from './supabase';

interface User {
    id: string;
    nickname: string;
    created_at?: string;
}

interface ChatRoom {
    id: string;
    name: string;
    created_at?: string;
}

interface ChatRoomMember {
    id: string;
    name: string;
    extra_info: string;
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

// messages-container 요소가 있는지 확인하고 없으면 생성
function ensureMessagesContainer() {
    let messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'messages-container';
        const messageList = document.getElementById('messageList');
        if (messageList) {
            messageList.appendChild(messagesContainer);
        }
    }
    return messagesContainer;
}

// 메시지 표시 함수 개선
function displayMessages(messages: Message[] | Message[][]) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer || !currentChatRoom) return;

    const normalizedMessages = Array.isArray(messages[0]) ? messages[0] as Message[] : messages as Message[];
    
    // 현재 채팅방 메시지만 필터링
    const roomMessages = normalizedMessages.filter(msg => 
        msg.chat_room_id === currentChatRoom?.id
    );

    roomMessages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.user_id === currentUserId ? 'sent' : 'received'}`;
        
        const userName = message.user_id === currentUserId ? '나' : `사용자 ${message.user_id.slice(0, 4)}`;
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="user-name">${userName}</span>
                <span class="time">${formatTime(message.created_at || '')}</span>
            </div>
            <div class="content">${message.content}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
    });

    // 스크롤을 최하단으로
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
    if (!currentChatRoom || !currentChatRoom.id) {
        console.error('채팅방이 선택되지 않았습니다.');
        return;
    }
    
    if (!content.trim()) {
        console.error('메시지가 비어있습니다.');
        return;
    }
    
    if (!currentUserId) {
        console.error('사용자 ID가 없습니다.');
        return;
    }
    
    console.log('메시지 전송 시도:', {
        roomId: currentChatRoom.id,
        content: content,
        userId: currentUserId
    });
    
    // 메시지 전송 요청
    parent.postMessage({
        pluginMessage: {
            type: 'send-message',
            roomId: currentChatRoom.id,
            content: content,
            userId: currentUserId
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
            table: 'Messages',
            params: {
                chatRoomId: currentChatRoom.id
            }
        }
    }, '*');
}

// 이전 메시지 로드
async function loadMessages(roomId?: string) {
    if (!currentChatRoom && !roomId) return;
    
    const targetRoomId = roomId || currentChatRoom!.id;
    
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'loadMessages',
            table: 'Messages',
            method: 'GET',
            params: {
                chat_room_id: targetRoomId,
                limit: 50
            }
        }
    }, '*');
}

// 초기화 함수
async function initializeApp() {
    console.log('UI 초기화 시작');
    
    // 메시지 이벤트 핸들러 설정
    window.onmessage = async (event) => {
        const msg = event.data.pluginMessage;
        if (!msg) return;

        console.log('UI가 플러그인으로부터 메시지 수신:', msg);

        switch (msg.type) {
            case 'plugin-ready':
                updateStatus('플러그인 준비 완료');
                currentUserId = msg.userId;
                // 플러그인 준비되면 채팅방 목록 로드
                loadChatRooms();
                break;
                
            case 'supabase-response':
                if (msg.action === 'getChatRooms' && msg.result.data) {
                    console.log('채팅방 목록 수신:', msg.result.data);
                    displayChatRooms(msg.result.data);
                }
                break;

            case 'new-messages':
                if (msg.messages) {
                    displayMessages(msg.messages);
                }
                break;

            case 'error':
                updateStatus(msg.error, true);
                break;
        }
    };
}

// UI 이벤트 설정
function setupUIEvents() {
    const messageInput = document.getElementById('messageInput') as HTMLInputElement;
    const sendButton = document.getElementById('sendButton');

    if (messageInput && sendButton) {
        const handleSendMessage = () => {
            const content = messageInput.value.trim();
            if (content && currentChatRoom && currentUserId) {
                console.log('메시지 전송 시도:', {
                    roomId: currentChatRoom.id,
                    content,
                    userId: currentUserId
                });
                
                parent.postMessage({
                    pluginMessage: {
                        type: 'send-message',
                        roomId: currentChatRoom.id,
                        content: content,
                        userId: currentUserId
                    }
                }, '*');
                
                messageInput.value = '';
            } else {
                console.error('메시지 전송 실패:', {
                    content: !!content,
                    currentChatRoom: !!currentChatRoom,
                    currentUserId: !!currentUserId
                });
            }
        };

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        sendButton.addEventListener('click', handleSendMessage);
    }
}

// UI 스타일 추가
const style = document.createElement('style');
style.textContent = `
    .chat-rooms {
        padding: 10px;
    }
    .chat-room-item {
        padding: 12px;
        margin: 8px 0;
        background: #f5f5f5;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .chat-room-item:hover {
        background: #e3f2fd;
        transform: translateY(-1px);
    }
    .room-name {
        font-weight: bold;
        margin-bottom: 4px;
    }
    .room-info {
        font-size: 12px;
        color: #666;
    }
    .chat-room-header {
        padding: 12px;
        background: #e3f2fd;
        border-radius: 8px 8px 0 0;
        font-weight: bold;
    }
    .loading {
        text-align: center;
        padding: 20px;
        color: #666;
    }
    .messages-container {
        padding: 10px;
        max-height: 400px;
        overflow-y: auto;
    }
    .chat-input-container {
        padding: 10px;
        background: #fff;
        border-top: 1px solid #eee;
        display: flex;
        gap: 8px;
    }
    
    #messageInput {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    #sendButton {
        padding: 8px 16px;
        background: #0066ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    #sendButton:hover {
        background: #0052cc;
    }
`;
document.head.appendChild(style);

style.textContent += `
    .message {
        margin: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        max-width: 80%;
        word-break: break-word;
        word-break: break-word;
    }
    
    .message.sent {
        background: #e3f2fd;
        margin-left: auto;
    }
    
    .message.received {
        background: #f5f5f5;
        margin-right: auto;
    
    .message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        font-size: 12px;
        color: #666;
    }
    }
    
    .message .content {
        font-size: 14px;
        margin: 4px 0;
    }
    .user-name {
        font-weight: bold;
        color: #333;
    }
    
    .time {
        margin-left: 8px;
        display: block;
    }
`;

// DOM 로드 시 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드됨');
    initializeApp().catch(error => {
        console.error('초기화 중 오류 발생:', error);
    });
});

// window onload 이벤트도 바인딩
window.onload = () => {
    console.log('Window 로드 완료');
};

// 채팅방 선택 이벤트 핸들러
function setupChatRoomEvents() {
    console.log('채팅방 이벤트 설정 시작');
    document.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        console.log('클릭된 요소:', target);
        
        if (target.classList.contains('chat-room-item')) {
            const roomId = target.dataset.roomId;
            console.log('선택된 채팅방 ID:', roomId);
            
            if (roomId) {
                await joinChatRoom(roomId);
            }
        }
    });
}

// 채팅방 참여 함수
async function joinChatRoom(roomId: string) {
    console.log('채팅방 참여:', roomId);
    
    const messageList = document.getElementById('messageList');
    if (!messageList) return;

    // 현재 채팅방 정보 업데이트
    currentChatRoom = { id: roomId } as ChatRoom;
    
    // 메시지 영역 초기화
    messageList.innerHTML = `
        <div class="chat-room-header">채팅방 #${roomId}</div>
        <div class="messages-container"></div>
    `;

    // UI 이벤트 재설정
    setupUIEvents();
    
    // 메시지 로드
    await loadMessages(roomId);
    
    // 실시간 구독 설정
    subscribeToMessages();
}

// 실시간 메시지 구독 설정
function setupRealtimeSubscription(roomId: string) {
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'subscribeToMessages',
            table: 'messages',
            params: { chatRoomId: roomId }
        }
    }, '*');
}

// 채팅방 목록 표시 함수 추가
function displayChatRooms(rooms: ChatRoom[]) {
    const chatRoomsList = document.getElementById('chatRoomsList');
    if (!chatRoomsList) {
        console.error('chatRoomsList element not found');
        return;
    }

    console.log('채팅방 목록 표시 시도:', rooms);

    // 채팅방 목록 HTML 생성
    chatRoomsList.innerHTML = `
        <h3>채팅방 목록</h3>
        <div class="chat-rooms">
            ${rooms.map(room => `
                <div class="chat-room-item" data-room-id="${room.id}">
                    <div class="room-name">${room.name || 'Unnamed Room'}</div>
                    <div class="room-info">
                        생성: ${room.created_at ? new Date(room.created_at).toLocaleString() : '날짜 없음'}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // 채팅방 클릭 이벤트 리스너 추가
    const chatRoomElements = chatRoomsList.querySelectorAll('.chat-room-item');
    chatRoomElements.forEach(element => {
        element.addEventListener('click', (e) => {
            const roomId = (e.currentTarget as HTMLElement).dataset.roomId;
            if (roomId) {
                // 이전 선택 제거
                chatRoomElements.forEach(el => el.classList.remove('selected'));
                // 현재 선택 표시
                element.classList.add('selected');
                // 채팅방 참여
                joinChatRoom(roomId);
            }
        });
    });
}

// 채팅방 목록 로드 함수
async function loadChatRooms() {
    parent.postMessage({
        pluginMessage: {
            type: 'supabase-request',
            action: 'getChatRooms'
        }
    }, '*');
}

// 초기화 시 채팅방 목록 로드
initializeApp().then(() => {
    loadChatRooms();
});

// 시간 포맷팅 함수 추가
function formatTime(timestamp: string): string {
    if (!timestamp) return '방금 전';
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

