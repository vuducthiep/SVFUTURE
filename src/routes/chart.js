const express = require('express');
const router = express.Router();
const axios = require('axios');

// Lấy dữ liệu nến BTC/USDT từ Binance
router.get('/btc', async (req, res) => {
    try {
        // Lấy nến 1h từ 20/4/2025
        const startTime = new Date('2025-08-01T00:00:00Z').getTime();
        const endTime = Date.now();
        let allCandles = [];
        let fetchStart = startTime;
        while (fetchStart < endTime) {
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000&startTime=${fetchStart}`;
            const response = await axios.get(binanceUrl);
            const candles = response.data.map(c => ({
                openTime: c[0],
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5]),
                closeTime: c[6]
            }));
            if (candles.length === 0) break;
            allCandles = allCandles.concat(candles);
            // Di chuyển fetchStart tới closeTime của nến cuối cùng + 1ms
            fetchStart = candles[candles.length - 1].closeTime + 1;
            // Nếu số nến trả về < 1000 thì đã hết dữ liệu
            if (candles.length < 1000) break;
        }
        res.json(allCandles);
    } catch (err) {
        res.json([]);
    }
});

module.exports = router;
