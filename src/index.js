require('dotenv').config();
const express = require('express');
// Sử dụng pool từ config/db.js
const app = express();

app.use(express.json());
// Phục vụ file tĩnh cho giao diện biểu đồ nến
app.use(express.static('public'));
// Import routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/trade', require('./routes/trade'));
app.use('/api/chart', require('./routes/chart'));

const db = require('./config/db');
db.getConnection()
    .then(() => {
        console.log('Kết nối MySQL thành công');
    })
    .catch((err) => {
        console.error('Lỗi kết nối MySQL:', err);
        process.exit(1);
    });

// Route mẫu
app.get('/', (req, res) => {
    res.send('Chào mừng đến với SVFUTURE Demo!');
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
