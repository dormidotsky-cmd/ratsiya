const WebSocket = require('ws');
const http = require('http');
const url = require('url');


const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Хранилище комнат и подключений
const rooms = new Map();
const connections = new Map();

wss.on('connection', (ws, request) => {
    const parameters = url.parse(request.url, true);
    const roomId = parameters.query.roomId;
    const clientId = generateId();
    
    console.log(`Новое подключение: ${clientId} к комнате: ${roomId}`);
    
    if (!roomId) {
        ws.close(1008, 'Room ID required');
        return;
    }

    // Сохраняем подключение
    connections.set(clientId, ws);
    ws.clientId = clientId;
    ws.roomId = roomId;

    // Добавляем в комнату
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(clientId);

    // Отправляем клиенту его ID
    sendToClient(ws, {
        type: 'connected',
        clientId: clientId,
        roomId: roomId
    });

    // Уведомляем других участников о новом клиенте
    broadcastToRoom(roomId, clientId, {
        type: 'user-joined',
        clientId: clientId
    });

    // Отправляем список текущих участников новому клиенту
    const usersInRoom = Array.from(rooms.get(roomId) || [])
        .filter(id => id !== clientId);
    
    if (usersInRoom.length > 0) {
        sendToClient(ws, {
            type: 'users-in-room',
            users: usersInRoom
        });
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Отключение: ${clientId} от комнаты: ${roomId}`);
        
        // Удаляем из комнаты
        if (rooms.has(roomId)) {
            rooms.get(roomId).delete(clientId);
            
            // Если комната пустая, удаляем её
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
            }
        }
        
        // Удаляем подключение
        connections.delete(clientId);
        
        // Уведомляем других участников
        broadcastToRoom(roomId, clientId, {
            type: 'user-left',
            clientId: clientId
        });
    });

    ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error);
    });
});

function handleMessage(ws, data) {
    const { type, targetClientId, ...messageData } = data;
    
    switch (type) {
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            if (targetClientId && connections.has(targetClientId)) {
                sendToClient(connections.get(targetClientId), {
                    ...messageData,
                    type: type,
                    fromClientId: ws.clientId
                });
            }
            break;
            
        case 'broadcast':
            // Широковещательное сообщение для всех в комнате
            broadcastToRoom(ws.roomId, ws.clientId, {
                ...messageData,
                fromClientId: ws.clientId
            });
            break;
            
        default:
            console.log('Неизвестный тип сообщения:', type);
    }
}

function sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function broadcastToRoom(roomId, excludeClientId, message) {
    if (rooms.has(roomId)) {
        rooms.get(roomId).forEach(clientId => {
            if (clientId !== excludeClientId && connections.has(clientId)) {
                sendToClient(connections.get(clientId), message);
            }
        });
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Сигнальный сервер запущен на порту ${PORT}`);
    console.log(`WebSocket URL: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Завершение работы сервера...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});
