const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Đóng lệnh
router.post('/close', auth, async (req, res) => {
    const { tradeId } = req.body;
    try {
        // Lấy lệnh cần đóng
        const [rows] = await db.execute('SELECT * FROM trades WHERE id = ? AND userId = ?', [tradeId, req.user.userId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy lệnh' });
        const trade = rows[0];
        if (trade.closed) return res.status(400).json({ message: 'Lệnh đã đóng rồi' });
        // Lấy giá BTC hiện tại
        const axios = require('axios');
        let currentPrice = null;
        try {
            const resp = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
            currentPrice = parseFloat(resp.data.price);
        } catch {
            return res.status(500).json({ message: 'Không lấy được giá hiện tại' });
        }
        // Tính PnL
        let pnl = 0;
        const leverage = trade.leverage || 1;
        if (trade.type === 'buy') {
            pnl = (currentPrice - trade.price) * trade.amount * leverage;
        } else {
            pnl = (trade.price - currentPrice) * trade.amount * leverage;
        }
        // Cộng lại ký quỹ + lãi/lỗ về tài khoản
        const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.userId]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
        // Tính lại số tiền ký quỹ ban đầu
        let margin = trade.amount * trade.price / (trade.leverage || 1);
        let newBalance = userRows[0].balance + margin + pnl;
        await db.execute('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.userId]);
        // Đánh dấu lệnh đã đóng và lưu pnl vào DB
        await db.execute('UPDATE trades SET closed = 1, closedAt = NOW(), pnl = ? WHERE id = ?', [pnl, tradeId]);
        res.json({ message: 'Đã đóng lệnh', pnl, balance: newBalance });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Thực hiện giao dịch future (mua/bán)
router.post('/', auth, async (req, res) => {
    const { type, symbol, amount, price, leverage } = req.body;
    // Tính lại số tiền ký quỹ từ amount và leverage
    // money = amount * price / leverage
    const money = +(amount * price / (leverage || 1));
    try {
        // Lấy user
        const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.userId]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
        const user = userRows[0];
        // Kiểm tra số dư khi mua: chỉ cần đủ số tiền ký quỹ
        if (type === 'buy' && user.balance < money) {
            return res.status(400).json({ message: 'Số dư không đủ' });
        }
        // Cập nhật số dư: chỉ trừ/cộng số tiền ký quỹ
        let newBalance = user.balance;
        if (type === 'buy') newBalance -= money;
        else newBalance += money;
        await db.execute('UPDATE users SET balance = ? WHERE id = ?', [newBalance, user.id]);
        // Lưu giao dịch
        await db.execute('INSERT INTO trades (userId, type, symbol, amount, price, leverage) VALUES (?, ?, ?, ?, ?, ?)', [user.id, type, symbol, amount, price, leverage || 1]);
        res.status(201).json({ message: 'Giao dịch thành công', balance: newBalance });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Lịch sử giao dịch
router.get('/history', auth, async (req, res) => {
    try {
        // Lấy lịch sử giao dịch
        const [trades] = await db.execute('SELECT * FROM trades WHERE userId = ? ORDER BY createdAt DESC', [req.user.userId]);
        // Lấy giá BTC hiện tại từ Binance
        const axios = require('axios');
        let currentPrice = null;
        try {
            const resp = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
            currentPrice = parseFloat(resp.data.price);
        } catch {
            currentPrice = null;
        }
        // Tính PnL cho từng giao dịch: lệnh đã đóng thì lấy pnl từ DB, chưa đóng thì tính realtime
        const tradesWithPnl = trades.map(trade => {
            let pnl = null;
            if (trade.closed) {
                pnl = trade.pnl;
            } else if (currentPrice && trade.price && trade.amount) {
                if (trade.type === 'buy') {
                    pnl = (currentPrice - trade.price) * trade.amount;
                } else {
                    pnl = (trade.price - currentPrice) * trade.amount;
                }
            }
            return { ...trade, pnl };
        });
        res.json(tradesWithPnl);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
