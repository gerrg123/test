import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// === Telegram
const TELEGRAM_TOKEN = '8162271048:AAFsXm_gTpVlmDzptfDzgXIqU7TNkyfmrKA';
const TELEGRAM_GROUP_CHAT_ID = '-1002659640179';

async function sendTelegramMessage(text, chatId = TELEGRAM_GROUP_CHAT_ID) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.ok) {
            console.error('❌ Telegram:', data.description);
        } else {
            console.log(`✅ TG повідомлення: ${chatId}`);
        }
    } catch (error) {
        console.error('❌ Telegram API помилка:', error.message);
    }
}

// === Налаштування
let cachedSpreads = [];
const priceHistory = new Map();
const signalTracker = new Map();

const HISTORY_LENGTH = 40;
const minSpread = 1;
const minVolume = 50000;
const maxVolume = 10000000;
const minVolatilityPercent = 20; // <- тільки якщо >= 20

// === Волатильність
const calculateVolatility = (history) => {
    if (history.length < 2) return 0;
    let totalChange = 0;
    for (let i = 1; i < history.length; i++) {
        totalChange += Math.abs(history[i] - history[i - 1]);
    }
    const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
    return (totalChange / avg) * 100;
};

// === Сигнали (3 на 30 хв)
const getSignalPermission = (symbol) => {
    const now = Date.now();
    const windowMs = 30 * 60 * 1000; // 30 хв
    let data = signalTracker.get(symbol);

    if (!data || now - data.startTime > windowMs) {
        data = { count: 1, startTime: now };
        signalTracker.set(symbol, data);
        return 1;
    }

    if (data.count < 1) {
        data.count += 1;
        return data.count;
    }

    return null;
};

// === Gate.io
const fetchGateData = async () => {
    try {
        const res = await fetch("https://api.gateio.ws/api/v4/spot/tickers");
        const tickerData = await res.json();

        const newSpreads = [];

        tickerData
            .filter(item => item.currency_pair.toUpperCase().endsWith("_USDT"))
            .forEach(item => {
                const symbol = item.currency_pair.toUpperCase();
                const ask = parseFloat(item.lowest_ask);
                const bid = parseFloat(item.highest_bid);
                const last = parseFloat(item.last);
                const price = (ask && bid) ? (ask + bid) / 2 : last || 0;
                const spread = (ask && bid) ? ((ask - bid) / ask) * 100 : 0;
                const volume = parseFloat(item.quote_volume);

                if (!symbol || isNaN(spread) || isNaN(price) || isNaN(volume)) return;

                if (!priceHistory.has(symbol)) priceHistory.set(symbol, []);
                const history = priceHistory.get(symbol);
                history.push(price);
                if (history.length > HISTORY_LENGTH) history.shift();

                const volatilityRaw = calculateVolatility(history);
                const volatility = parseFloat(volatilityRaw.toFixed(2)); // 👈 округлюємо перед перевіркою

                if (
                    spread >= minSpread &&
                    volume >= minVolume &&
                    volume <= maxVolume &&
                    volatility >= minVolatilityPercent
                ) {
                    const signalNumber = getSignalPermission(symbol);
                    if (signalNumber) {
                        const msg = `🚀 <b>Gate.io</b>: <a href="https://www.gate.io/trade/${symbol}">${symbol}</a>\n💰 Ціна: ${price.toFixed(6)}\n📈 Волатильність: ${volatility.toFixed(2)}%\n📊 Спред: ${spread.toFixed(2)}%\n💵 Обʼєм: ${volume.toFixed(0)} USDT\n📣 <b>Сигнал ${signalNumber}</b>`;
                        sendTelegramMessage(msg);
                        console.log(`📬 Сигнал ${signalNumber} для ${symbol}`);
                    }

                    newSpreads.push({
                        pair: symbol,
                        price: price.toFixed(6),
                        volume: volume.toFixed(2),
                        spread: spread.toFixed(2),
                        volatility: volatility.toFixed(2)
                    });
                }
            });

        cachedSpreads = newSpreads.sort((a, b) => b.volatility - a.volatility);
        console.log(`🔁 Оновлено Gate: ${cachedSpreads.length} монет`);
    } catch (error) {
        console.error("💥 Помилка Gate.io:", error.message);
    }
};

// === API
app.get('/spreads', (req, res) => {
    res.json({ spreads: cachedSpreads });
});

// === Запуск
app.listen(port, async () => {
    console.log(`🟢 Сервер запущено на http://localhost:${port}`);

    const now = new Date();
    const formattedTime = now.toISOString().replace('T', ' ').split('.')[0];
    await sendTelegramMessage(`✅ Бот стартував і працює! 🕒 ${formattedTime}`);

    fetchGateData();
    setInterval(fetchGateData, 3000);
});
