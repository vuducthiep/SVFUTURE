const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Sử dụng MySQL
const db = require('../config/db'); // Assuming you have a db config file

// Đăng ký
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) return res.status(400).json({ message: 'Username đã tồn tại' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'Đăng ký thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Đăng nhập
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(400).json({ message: 'Sai username hoặc password' });
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Sai username hoặc password' });
        let token = null;
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
            console.error('JWT_SECRET is missing or empty in .env');
            return res.status(500).json({ message: 'JWT_SECRET is missing or empty in server config. Vui lòng kiểm tra file .env.' });
        }
        try {
            token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        } catch (jwtErr) {
            console.error('JWT sign error:', jwtErr);
            return res.status(500).json({ message: 'Lỗi tạo token: ' + jwtErr.message });
        }
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Lỗi server: ' + err.message });
    }
});

module.exports = router;
