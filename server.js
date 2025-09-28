const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 8080; 

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const activeUsers = new Map(); 

io.on('connection', (socket) => {
    const clientId = socket.id; 
    console.log(`[CONNECT] Новый клиент подключен: ${clientId}`);
    
    // Функция для проверки существования целевого сокета
    const targetIsAvailable = (targetId) => {
        // io.sockets.sockets.get(id) - это самый надежный способ проверить,
        // находится ли сокет в пуле активных сокетов Socket.IO.
        return io.sockets.sockets.has(targetId);
    };

    // =================================================================
    // 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ (Без изменений)
    // =================================================================
    socket.on('register_user', (userId, nickname) => {
        console.log(`[REGISTER] Клиент ${userId} зарегистрирован как: ${nickname}`);
        
        activeUsers.set(userId, { nickname: nickname });

        const onlineUsers = Array.from(activeUsers.entries())
            .map(([id, data]) => ({
                clientId: id,
                nickname: data.nickname
            }));
        
        const listToSend = onlineUsers.filter(u => u.clientId !== userId);
        socket.emit('users-list', { users: listToSend }); 
        
        socket.broadcast.emit('user-joined', { clientId: userId, nickname: nickname });
    });


    // ---------------------------------------------
    // 2. УЛУЧШЕННАЯ ОБРАБОТКА WEB-RTC СИГНАЛИЗАЦИИ
    // ---------------------------------------------
        
    const handleSignal = (eventType, targetId, payload) => {
        const senderClientId = socket.id;

        if (!targetIsAvailable(targetId)) {
            // Если целевой клиент недоступен, сообщаем отправителю
            console.warn(`[SIGNAL ERROR] ${eventType} от ${senderClientId}: Цель ${targetId} недоступна. Отправка остановлена.`);
            socket.emit('error', `Целевой пользователь (${targetId}) недоступен.`);
            return false;
        }

        // Перенаправляем сообщение
        io.to(targetId).emit(eventType, senderClientId, payload);
        console.log(`[${eventType.toUpperCase()}] От ${senderClientId} к ${targetId}. Payload keys: ${Object.keys(payload)} -> OK`);
        return true;
    };

    // Обработчик 'offer'
    socket.on('offer', (targetId, sdpPayload) => {
        handleSignal('offer', targetId, sdpPayload);
    });

    // Обработчик 'answer'
    socket.on('answer', (targetId, sdpPayload) => {
        handleSignal('answer', targetId, sdpPayload);
    });

    // Обработчик 'ice-candidate'
    socket.on('ice-candidate', (targetId, candidatePayload) => {
        handleSignal('ice-candidate', targetId, candidatePayload);
    });
    
    // =================================================================
    // 3. ОБРАБОТКА ОТКЛЮЧЕНИЯ (Без изменений)
    // =================================================================
    socket.on('disconnect', () => {
        const userData = activeUsers.get(clientId); 
        
        console.log(`[DISCONNECT] Клиент отключен: ${clientId} (${userData?.nickname || 'Anon'})`);
        
        activeUsers.delete(clientId);
        
        if (userData) {
            socket.broadcast.emit('user-left', { clientId: clientId, nickname: userData.nickname });
        }
    });
});


server.listen(PORT, () => {
    console.log(`Сигнальный сервер запущен на ws://localhost:${PORT}`);
});
