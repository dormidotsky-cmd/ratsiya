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
    
    const targetIsAvailable = (targetId) => {
        return io.sockets.sockets.has(targetId);
    };

    // =================================================================
    // 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ 
    // =================================================================
    socket.on('register_user', (nickname) => {
        const currentClientId = socket.id;
        let oldClientId = null;
        
        // 1. Поиск и удаление старого ID с этим же nickname
        activeUsers.forEach((user, id) => {
            if (user.nickname === nickname && id !== currentClientId) {
                oldClientId = id;
            }
        });
        
        if (oldClientId) {
            activeUsers.delete(oldClientId);
            // Оповещаем ВСЕХ, что старый ID ушел
            io.emit('user-left', { clientId: oldClientId, nickname: nickname }); 
            console.log(`[REGISTER CLEANUP] Удален старый ID ${oldClientId} для пользователя ${nickname}.`);
        }
        
        // 2. Регистрация нового ID
        activeUsers.set(currentClientId, { nickname });

        // 3. Отправляем полный список НОВОМУ клиенту (через users-list)
        const onlineUsers = Array.from(activeUsers.entries())
            .map(([id, data]) => ({ clientId: id, nickname: data.nickname }));

        const listToSend = onlineUsers.filter(u => u.clientId !== currentClientId);
        socket.emit('users-list', { users: listToSend });
        
        // 4. Оповещаем остальных, что новый ID пришел
        socket.broadcast.emit('user-joined', { clientId: currentClientId, nickname });
        
        console.log(`[REGISTER] Клиент ${currentClientId} зарегистрирован как ${nickname}. Список отправлен.`);
    });


    // =================================================================
    // 2. ОБРАБОТКА СИГНАЛИЗАЦИИ
    // =================================================================
    const handleSignal = (eventType, targetId, payload) => {
        const senderClientId = socket.id;

        if (!targetIsAvailable(targetId)) {
            console.warn(`[SIGNAL ERROR] ${eventType} от ${senderClientId}: Цель ${targetId} недоступна. Отправка остановлена.`);
            socket.emit('error', `Целевой пользователь (${targetId.substring(0,6)}...) недоступен.`);
            return false;
        }

        io.to(targetId).emit(eventType, senderClientId, payload);
        console.log(`[${eventType.toUpperCase()}] От ${senderClientId.substring(0,6)} к ${targetId.substring(0,6)} -> OK`);
        return true;
    };

    socket.on('offer', (targetId, sdpPayload) => {
        handleSignal('offer', targetId, sdpPayload);
    });

    socket.on('answer', (targetId, sdpPayload) => {
        handleSignal('answer', targetId, sdpPayload);
    });

    socket.on('ice-candidate', (targetId, candidatePayload) => {
        handleSignal('ice-candidate', targetId, candidatePayload);
    });
    
    // =================================================================
    // 3. ОБРАБОТЧИКИ УПРАВЛЕНИЯ
    // =================================================================
    
    // ОБРАБОТЧИК: Запрос актуального списка (от onConnected)
    socket.on('get_users', () => {
        const onlineUsers = Array.from(activeUsers.entries())
            .map(([id, data]) => ({ clientId: id, nickname: data.nickname }));

        const listToSend = onlineUsers.filter(u => u.clientId !== socket.id);
        
        socket.emit('users-list', { users: listToSend });
        console.log(`[GET_USERS] Клиент ${socket.id.substring(0,6)} запросил и получил актуальный список пользователей (${listToSend.length}).`);
    });

    // ОБРАБОТЧИК: Завершение звонка 
    socket.on('call_ended', (targetId) => {
        const senderClientId = socket.id;
        
        console.log(`[CALL_ENDED] Сигнал завершения звонка от ${senderClientId.substring(0,6)} для ${targetId.substring(0,6)}.`);

        if (targetIsAvailable(targetId)) {
             io.to(targetId).emit('call_ended_confirmation', senderClientId); 
        }
    });


    // =================================================================
    // 4. ОБРАБОТКА ОТКЛЮЧЕНИЯ
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
