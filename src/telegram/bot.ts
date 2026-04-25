import TelegramBot from 'node-telegram-bot-api';
import { SupportAgent } from '../agents/supportAgent';
import logger from '../tools/logger';
import { Client } from '@notionhq/client';

const token = process.env.SALES_TELEGRAM_BOT_TOKEN!;
const agent = new SupportAgent();
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const summariesDbId = process.env.NOTION_SUMMARIES_DB_ID!;
const lastResponses = new Map<string, { userMessage: string; botResponse: string }>();

// Пауза в зависимости от длины текста
function calculateTypingDelay(text: string): number {
  const wordsPerMinute = 200; // средняя скорость набора
  const words = text.split(' ').length;
  const baseDelay = (words / wordsPerMinute) * 60 * 1000;
  const randomFactor = Math.random() * 1000 + 500; // случайность 500-1500ms
  return Math.min(baseDelay + randomFactor, 6000); // максимум 6 секунд
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveFeedback(
  sessionId: string,
  userMessage: string,
  botResponse: string,
  rating: 'good' | 'bad'
) {
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
    logger.info(`Feedback saved: ${rating} for session ${sessionId}`);
  } catch (error) {
    logger.error('Failed to save feedback:', error);
  }
}

export function startTelegramBot() {
  if (!token) {
    logger.warn('SALES_TELEGRAM_BOT_TOKEN not set, skipping Telegram bot');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  logger.info('Telegram support bot started');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

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

    } catch (error) {
      logger.error('Telegram bot error:', error);
      await bot.sendMessage(chatId, 'Извините, произошла ошибка. Попробуйте позже.');
    }
  });

  // Обработка кнопок оценки
  bot.on('callback_query', async (query) => {
    if (!query.data || !query.message) return;

    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('feedback_')) {
      const parts = data.split('_');
      const rating = parts[1] as 'good' | 'bad';
      const sessionId = parts.slice(2).join('_');

      const lastExchange = lastResponses.get(sessionId);
      if (lastExchange) {
        await saveFeedback(
          sessionId,
          lastExchange.userMessage,
          lastExchange.botResponse,
          rating
        );
      }

      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id }
      );

      await bot.answerCallbackQuery(query.id, {
        text: rating === 'good' ? 'Спасибо за оценку!' : 'Учтём, станем лучше.',
        show_alert: false,
      });
    }
  });

  bot.on('polling_error', (error) => {
    logger.error('Telegram polling error:', error);
  });

  return bot;
}