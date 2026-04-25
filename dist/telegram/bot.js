"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTelegramBot = startTelegramBot;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const supportAgent_1 = require("../agents/supportAgent");
const logger_1 = __importDefault(require("../tools/logger"));
const client_1 = require("@notionhq/client");
const token = process.env.TELEGRAM_BOT_TOKEN;
const agent = new supportAgent_1.SupportAgent();
const notion = new client_1.Client({ auth: process.env.NOTION_API_KEY });
const summariesDbId = process.env.NOTION_SUMMARIES_DB_ID;
const lastResponses = new Map();
// Пауза в зависимости от длины текста
function calculateTypingDelay(text) {
    const wordsPerMinute = 200; // средняя скорость набора
    const words = text.split(' ').length;
    const baseDelay = (words / wordsPerMinute) * 60 * 1000;
    const randomFactor = Math.random() * 1000 + 500; // случайность 500-1500ms
    return Math.min(baseDelay + randomFactor, 6000); // максимум 6 секунд
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function saveFeedback(sessionId, userMessage, botResponse, rating) {
    try {
        await notion.pages.create({
            parent: { database_id: summariesDbId },
            properties: {
                'Session ID': {
                    rich_text: [{ text: { content: sessionId } }],
                },
                'Final Intent': {
                    select: { name: rating === 'good' ? 'purchase_intent' : 'objection' },
                },
                'Created At': {
                    date: { start: new Date().toISOString() },
                },
            },
            children: [
                {
                    object: 'block',
                    type: 'callout',
                    callout: {
                        rich_text: [{
                                type: 'text',
                                text: {
                                    content: `Оценка: ${rating === 'good' ? 'Помогло' : 'Не помогло'}\n\nКлиент: ${userMessage}\n\nАгент: ${botResponse}`
                                }
                            }],
                        icon: { emoji: rating === 'good' ? '✅' : '❌' },
                    },
                },
            ],
        });
        logger_1.default.info(`Feedback saved: ${rating} for session ${sessionId}`);
    }
    catch (error) {
        logger_1.default.error('Failed to save feedback:', error);
    }
}
function startTelegramBot() {
    if (!token) {
        logger_1.default.warn('SALES_TELEGRAM_BOT_TOKEN not set, skipping Telegram bot');
        return;
    }
    const bot = new node_telegram_bot_api_1.default(token, { polling: true });
    logger_1.default.info('Telegram support bot started');
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text)
            return;
        const sessionId = `tg_${chatId}`;
        try {
            // Сразу показываем "печатает..."
            await bot.sendChatAction(chatId, 'typing');
            // Получаем ответ от агента
            const response = await agent.processMessage(sessionId, text);
            // Считаем паузу под длину ответа
            const delay = calculateTypingDelay(response);
            // Показываем "печатает..." во время паузы
            // Telegram сбрасывает статус через 5 секунд, поэтому обновляем
            const intervals = Math.ceil(delay / 4000);
            for (let i = 0; i < intervals; i++) {
                await bot.sendChatAction(chatId, 'typing');
                await sleep(Math.min(4000, delay - i * 4000));
            }
            // Сохраняем для оценки
            lastResponses.set(sessionId, {
                userMessage: text,
                botResponse: response,
            });
            // Отправляем ответ с кнопками оценки
            await bot.sendMessage(chatId, response, {
                reply_markup: {
                    inline_keyboard: [[
                            { text: 'Помогло', callback_data: `feedback_good_${sessionId}` },
                            { text: 'Не помогло', callback_data: `feedback_bad_${sessionId}` },
                        ]],
                },
            });
        }
        catch (error) {
            logger_1.default.error('Telegram bot error:', error);
            await bot.sendMessage(chatId, 'Извините, произошла ошибка. Попробуйте позже.');
        }
    });
    // Обработка кнопок оценки
    bot.on('callback_query', async (query) => {
        if (!query.data || !query.message)
            return;
        const chatId = query.message.chat.id;
        const data = query.data;
        if (data.startsWith('feedback_')) {
            const parts = data.split('_');
            const rating = parts[1];
            const sessionId = parts.slice(2).join('_');
            const lastExchange = lastResponses.get(sessionId);
            if (lastExchange) {
                await saveFeedback(sessionId, lastExchange.userMessage, lastExchange.botResponse, rating);
            }
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
            await bot.answerCallbackQuery(query.id, {
                text: rating === 'good' ? 'Спасибо за оценку!' : 'Учтём, станем лучше.',
                show_alert: false,
            });
        }
    });
    bot.on('polling_error', (error) => {
        logger_1.default.error('Telegram polling error:', error);
    });
    return bot;
}
//# sourceMappingURL=bot.js.map