// signaling-server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'join') {
            ws.roomId = data.roomId;
            if (!rooms.has(data.roomId)) {
                rooms.set(data.roomId, new Set());
            }
            rooms.get(data.roomId).add(ws);
        }
        
        if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    });
});
