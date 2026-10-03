const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

// Lưu trữ trạng thái các slot (socket.id -> playerNumber)
const playerMap = {};

function getTakenSlots() {
    return Object.values(playerMap);
}

io.on('connection', (socket) => {
    console.log('Người dùng kết nối:', socket.id);
    
    // Gửi danh sách slot đã bị chiếm cho người vừa vào
    socket.emit('playersUpdate', getTakenSlots());

    socket.on('registerHost', () => {
        socket.join('host');
        console.log('Host đã đăng ký:', socket.id);
        socket.emit('playersUpdate', getTakenSlots());
    });

    socket.on('requestPlayer', (playerNum, callback) => {
        const taken = getTakenSlots();
        if (taken.includes(playerNum)) {
            // Đã có người chọn
            callback({ success: false, message: 'Slot này đã có người chơi!' });
        } else {
            // Xóa slot cũ nếu người này chọn lại slot khác
            if (playerMap[socket.id]) {
                delete playerMap[socket.id];
            }
            playerMap[socket.id] = playerNum;
            callback({ success: true });
            
            // Cập nhật cho TẤT CẢ mọi người (Host và các Controller khác)
            io.emit('playersUpdate', getTakenSlots());
        }
    });

    socket.on('controllerAction', (data) => {
        // Xác thực: chỉ gửi phím nếu đúng là chủ của slot đó
        if (playerMap[socket.id] === data.player) {
            io.to('host').emit('simulateKey', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối:', socket.id);
        if (playerMap[socket.id]) {
            delete playerMap[socket.id];
            // Cập nhật lại cho TẤT CẢ mọi người
            io.emit('playersUpdate', getTakenSlots());
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
});
