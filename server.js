const WebSocket = require('ws');

// Создаем WebSocket-сервер на порту 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log('Signaling server started on port 8080');

// Обработчик события нового подключения клиента
wss.on('connection', ws => {
    console.log('New client connected!');

    // Обработчик события получения сообщения от клиента
    ws.on('message', message => {
        // Мы получили сообщение от одного клиента
        console.log(`Received message => ${message}`);

        // Отправляем сообщение всем остальным подключенным клиентам (кроме отправителя)
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    // Обработчик события закрытия соединения
    ws.on('close', () => {
        console.log('Client disconnected.');
    });

    // Отправляем приветственное сообщение новому клиенту
    ws.send('Hello from signaling server!');
});
