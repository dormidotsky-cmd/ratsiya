// server.js

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const PORT = 3000;

app.get('/', (req, res) => {
    res.send('<h1>Сигнальный сервер работает!</h1>');
});

io.on('connection', (socket) => {
    console.log('Пользователь подключен:', socket.id);

    // Событие для обмена offer
    socket.on('offer', (data) => {
        console.log('Получен offer, отправляем его другому клиенту');
        socket.broadcast.emit('offer', data); // Отправляем всем, кроме отправителя
    });

    // Событие для обмена answer
    socket.on('answer', (data) => {
        console.log('Получен answer, отправляем его другому клиенту');
        socket.broadcast.emit('answer', data);
    });

    // Событие для обмена ICE-кандидатами
    socket.on('iceCandidate', (data) => {
        console.log('Получен ICE-кандидат, отправляем его другому клиенту');
        socket.broadcast.emit('iceCandidate', data);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключен:', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Сервер слушает на порту ${PORT}`);
});
