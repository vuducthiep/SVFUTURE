const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Lấy thông tin tài khoản
router.get('/me', auth, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, username, balance, createdAt FROM users WHERE id = ?', [req.user.userId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
