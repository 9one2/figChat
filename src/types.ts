interface ChatRoom {
    id: string;
    name: string;
    created_at?: string;
}

interface Message {
    id: string;
    chat_room_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

interface User {
    id: string;
    name: string;
    avatar_url?: string;
    created_at?: string;
} 