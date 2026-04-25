// src/agents/supportAgent.ts
import { GigaChatClient } from '../tools/gigachatClient';
import { config } from '../config';
import { OrderDatabase, Order, Customer } from '../tools/orderDatabase';
import logger from '../tools/logger';
import * as fs from 'fs';
import * as path from 'path';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface SupportState {
  sessionId: string;
  userId?: string;
  history: Message[];
  clientName?: string;
  clientId?: string;
  clientEmail?: string;
  clientPhone?: string;
  awaitingContact?: boolean;
  currentIssue?: {
    category: string;
    intent: string;
    description: string;
  };
  stage: 'greeting' | 'problem_identification' | 'solution' | 'resolution' | 'closing';
  resolved: boolean;
  ticketId?: string;
}

interface SupportExample {
  intent_ru: string;
  category_ru: string;
  instruction_ru: string;
  response_ru: string;
  issue_type?: string;
  outcome?: string;
}

const sessions = new Map<string, SupportState>();

export class SupportAgent {
  private gigachat: GigaChatClient | null = null;
  private examples: SupportExample[] = [];
  private orderDb: OrderDatabase;

  constructor() {
    if (config.gigachat.authKey) {
      this.gigachat = new GigaChatClient();
      logger.info('✅ GigaChat initialized');
    }
    this.orderDb = new OrderDatabase();
    this.loadExamples();
  }

  private loadExamples(): void {
    try {
      const examplesPath = path.join(process.cwd(), 'data/translated/support_examples_ru.json');
      
      if (fs.existsSync(examplesPath)) {
        const data = fs.readFileSync(examplesPath, 'utf-8');
        this.examples = JSON.parse(data);
        logger.info(`📚 Загружено ${this.examples.length} примеров техподдержки`);
        
        const intents = [...new Set(this.examples.map(ex => ex.intent_ru))];
        logger.info(`📋 Доступные интенты: ${intents.slice(0, 10).join(', ')}...`);
      } else {
        logger.warn('⚠️ Файл с примерами не найден, использую встроенные');
        this.loadDefaultExamples();
      }
    } catch (error) {
      logger.error('Ошибка загрузки датасета:', error);
      this.loadDefaultExamples();
    }
  }

  private loadDefaultExamples(): void {
    this.examples = [
      {
        intent_ru: "отследить заказ",
        category_ru: "ORDER",
        instruction_ru: "Где мой заказ?",
        response_ru: "Чтобы отследить заказ, нужен номер заказа. Напишите его — я проверю статус."
      },
      {
        intent_ru: "отмена заказа",
        category_ru: "ORDER",
        instruction_ru: "Хочу отменить заказ",
        response_ru: "Для отмены зайдите в личный кабинет → Мои заказы → Отменить. Деньги вернутся автоматически."
      },
      {
        intent_ru: "проблема с оплатой",
        category_ru: "PAYMENT",
        instruction_ru: "Не могу оплатить",
        response_ru: "Попробуйте очистить кэш браузера или использовать другую карту. Какая ошибка возникает?"
      }
    ];
    logger.info(`📚 Загружено ${this.examples.length} встроенных примеров`);
  }

  private findRelevantExamples(query: string, limit: number = 3): SupportExample[] {
    const lowerQuery = query.toLowerCase();
    const relevant = this.examples.filter(ex =>
      ex.instruction_ru.toLowerCase().includes(lowerQuery) ||
      ex.intent_ru.toLowerCase().includes(lowerQuery) ||
      ex.category_ru.toLowerCase().includes(lowerQuery)
    );
    
    if (relevant.length === 0) {
      const shuffled = [...this.examples];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, limit);
    }
    
    return relevant.slice(0, limit);
  }

  private extractClientName(text: string): string | undefined {
    const match =
      text.match(/меня зовут\s+([А-ЯЁа-яё]+)/i) ||
      text.match(/зовите меня\s+([А-ЯЁа-яё]+)/i) ||
      text.match(/я\s+([А-ЯЁ][а-яё]+)/i) ||
      text.match(/^([А-ЯЁ][а-яё]{2,15})$/);
    return match?.[1];
  }

  private detectIntent(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('возврат') || lowerMsg.includes('вернуть')) return 'refund';
    if (lowerMsg.includes('доставк') || lowerMsg.includes('где мо')) return 'delivery';
    if (lowerMsg.includes('оплат') || lowerMsg.includes('карт')) return 'payment';
    if (lowerMsg.includes('отмен') || lowerMsg.includes('отказа')) return 'cancel_order';
    if (lowerMsg.includes('заказ') || lowerMsg.includes('номер заказа') || lowerMsg.includes('мои заказы') || lowerMsg.includes('все заказы')) return 'track_order';
    if (lowerMsg.includes('аккаунт') || lowerMsg.includes('пароль')) return 'account';
    if (lowerMsg.includes('чек') || lowerMsg.includes('счет')) return 'invoice';
    
    return 'general';
  }

  // ➕ Вспомогательный метод: форматирование списка заказов (т.к. formatOrdersList нет в БД)
  private formatOrdersListInline(orders: Order[], customer: Customer): string {
    if (!orders.length) return `У ${customer.first_name} пока нет заказов.`;
    let msg = `📦 Заказы ${customer.first_name}:\n`;
    orders.slice(0, 5).forEach(o => {
      const amount = parseFloat(o.order_amount || '0').toLocaleString('ru-RU');
      const date = o.order_date ? new Date(o.order_date).toLocaleDateString('ru-RU') : 'н/д';
      msg += `• ${o.order_id?.substring(0, 8)}... | ${date} | ${amount}₽ | ${o.status}\n`;
    });
    if (orders.length > 5) msg += `...и ещё ${orders.length - 5} заказов\n`;
    return msg.trim();
  }

  private handleOrderQuery(userMessage: string, state: SupportState): string | null {
    // 1. Поиск по полному UUID заказа
    const uuidMatch = userMessage.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      const orderId = uuidMatch[0];
      logger.info(`🔍 Ищем заказ по UUID: ${orderId}`);
      const order = this.orderDb.getOrderById(orderId);
      
      if (order) {
        const response = this.orderDb.formatOrderInfo(order);
        state.currentIssue = {
          category: 'order',
          intent: 'track_order',
          description: `Проверка заказа ${orderId}`
        };
        state.stage = 'resolution';
        return response;
      }
      return `Заказ с номером ${orderId} не найден. Проверьте правильность номера.`;
    }

    // 2. Поиск по email → клиент → заказы (исправлено: используем реальные методы БД)
    const emailMatch = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) {
      const email = emailMatch[0];
      logger.info(`📧 Ищем заказы по email: ${email}`);
      const customer = this.orderDb.findCustomerByContact(email);
      
      if (customer) {
        const orders = this.orderDb.getOrdersByCustomerId(customer.customer_id);
        if (orders.length > 0) {
          state.currentIssue = {
            category: 'order',
            intent: 'list_orders',
            description: `Заказы ${email}`
          };
          state.stage = 'resolution';
          return this.formatOrdersListInline(orders, customer);
        }
      }
      return `Заказов для почты ${email} не найдено. Проверьте правильность адреса.`;
    }

    // 3. Поиск по телефону (исправлено: используем реальные методы БД)
    const phoneMatch = userMessage.match(/[\+]?[\d\-\(\)\s]{10,}/);
    if (phoneMatch) {
      const phone = phoneMatch[0];
      logger.info(`📞 Ищем заказы по телефону: ${phone}`);
      const customer = this.orderDb.findCustomerByContact(phone);
      
      if (customer) {
        const orders = this.orderDb.getOrdersByCustomerId(customer.customer_id);
        if (orders.length > 0) {
          state.currentIssue = {
            category: 'order',
            intent: 'list_orders',
            description: `Заказы ${customer.first_name}`
          };
          state.stage = 'resolution';
          return this.formatOrdersListInline(orders, customer);
        }
      }
      return `Заказов для номера ${phone} не найдено. Проверьте правильность номера.`;
    }

    // 4. Поиск по имени (имя + фамилия) — оставляем как есть, но с фиксом методов
    const nameMatch = userMessage.match(/[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z][а-яёa-z]+/i);
    if (nameMatch && !uuidMatch && !emailMatch && !phoneMatch) {
      const name = nameMatch[0];
      logger.info(`👤 Ищем заказы по имени: ${name}`);
      const customer = this.orderDb.findCustomerByContact(name);
      
      if (customer) {
        const orders = this.orderDb.getOrdersByCustomerId(customer.customer_id);
        if (orders.length > 0) {
          state.currentIssue = {
            category: 'order',
            intent: 'list_orders',
            description: `Заказы ${customer.first_name}`
          };
          state.stage = 'resolution';
          return this.formatOrdersListInline(orders, customer);
        }
      }
      return `Заказов для имени ${name} не найдено. Уточните email или номер заказа.`;
    }

    // 5. Поиск по короткому ID (первые символы UUID)
    const shortMatch = userMessage.match(/\b([a-f0-9]{8,12})\b/i);
    if (shortMatch) {
      const order = this.orderDb.getOrderById(shortMatch[1]);
      if (order) {
        state.currentIssue = {
          category: 'order',
          intent: 'track_order',
          description: `Проверка заказа ${order.order_id.substring(0, 12)}`
        };
        state.stage = 'resolution';
        return this.orderDb.formatOrderInfo(order);
      }
    }

    return null;
  }

  private detectStageTransition(userMessage: string, state: SupportState): void {
    const name = this.extractClientName(userMessage);
    if (name && !state.clientName) {
      state.clientName = name;
    }

    const intent = this.detectIntent(userMessage);
    
    switch (state.stage) {
      case 'greeting':
        state.stage = 'problem_identification';
        break;

      case 'problem_identification':
        if (intent !== 'general' || userMessage.length > 10) {
          state.stage = 'solution';
          if (!state.currentIssue) {
            state.currentIssue = {
              category: intent,
              intent: intent,
              description: userMessage
            };
          }
        }
        break;

      case 'solution':
        if (/спасибо|помогло|всё понял|решил|работает/i.test(userMessage)) {
          state.stage = 'resolution';
          state.resolved = true;
        } else if (/(не помогло|не работает|ошибка|проблема|не решилось)/i.test(userMessage)) {
          state.stage = 'problem_identification';
          state.resolved = false;
        }
        break;

      case 'resolution':
        if (/да|всё|хорошо|спасибо/i.test(userMessage)) {
          state.stage = 'closing';
        } else if (/нет|не помогло/i.test(userMessage)) {
          state.stage = 'problem_identification';
        }
        break;

      case 'closing':
        break;
    }
  }

  private getStageInstruction(state: SupportState, examples: SupportExample[]): string {
    const clientRef = state.clientName || 'клиент';

    switch (state.stage) {
      case 'greeting':
        return 'Поприветствуй клиента. Представься как специалист техподдержки. Спроси чем можешь помочь.';

      case 'problem_identification':
        if (!state.clientName) {
          return 'Спроси только одно: "Как мне к вам обращаться?" Больше ничего не спрашивай.';
        }
        return `Выясни проблему ${clientRef}. Задай 1-2 уточняющих вопроса.

Вот примеры похожих ситуаций:
${examples.map(ex => `Клиент: ${ex.instruction_ru}\nАгент: ${ex.response_ru}`).join('\n\n')}`;

      case 'solution':
        return `Предложи решение проблемы ${clientRef}. Используй примеры выше. Отвечай кратко — 2-4 предложения.`;

      case 'resolution':
        return `Уточни у ${clientRef}: "Помогло ли решение? Остались ли вопросы?"`;

      case 'closing':
        return `Поблагодари ${clientRef} за обращение. Скажи что будем рады помочь снова. Пожелай хорошего дня.`;

      default:
        return 'Помоги клиенту решить его проблему.';
    }
  }

  async processMessage(sessionId: string, userMessage: string): Promise<string> {
    try {
      if (!this.gigachat) return this.getFallbackResponse();

      let state = sessions.get(sessionId);
      if (!state) {
        state = {
          sessionId,
          history: [],
          stage: 'greeting',
          resolved: false
        };
        sessions.set(sessionId, state);
      }

      // 🔄 Обработка команды /start
      if (userMessage === '/start') {
        const greeting = 'Здравствуйте! Я Александр, специалист технической поддержки. Чем могу помочь?';
        state.history.push({ role: 'user', content: userMessage, timestamp: new Date() });
        state.history.push({ role: 'assistant', content: greeting, timestamp: new Date() });
        state.stage = 'problem_identification';
        sessions.set(sessionId, state);
        return greeting;
      }

      // 🔍 БЛОК: Обработка ввода контакта клиента (ДОБАВЛЕНО)
      // Если ждём контакт от клиента
      if (state.awaitingContact) {
        const customer = this.orderDb.findCustomerByContact(userMessage);

        if (customer) {
          state.clientName = customer.first_name;
          state.clientId = customer.customer_id;
          state.clientEmail = customer.email;
          state.clientPhone = customer.phone_number; // ← ИСПРАВЛЕНО: phone → phone_number
          state.awaitingContact = false;

          const response = this.orderDb.formatCustomerStats(customer, customer.customer_id);
          state.history.push({ role: 'assistant', content: response, timestamp: new Date() });
          sessions.set(sessionId, state);
          return response;
        } else {
          const response = `Не нашёл вас по этим данным. Попробуйте указать email или номер телефона ещё раз, или напишите ваш вопрос — я постараюсь помочь.`;
          state.history.push({ role: 'assistant', content: response, timestamp: new Date() });
          sessions.set(sessionId, state);
          return response;
        }
      }

      // Если имя не известно — просим контакт (ДОБАВЛЕНО)
      if (!state.clientName && !state.awaitingContact && userMessage !== '/start') {
        state.awaitingContact = true;
        const response = `Здравствуйте! Уточните ваш номер телефона или email — я найду вас среди клиентов и смогу помочь быстрее.`;
        state.history.push({ role: 'user', content: userMessage, timestamp: new Date() });
        state.history.push({ role: 'assistant', content: response, timestamp: new Date() });
        sessions.set(sessionId, state);
        return response;
      }
      // 🔍 КОНЕЦ БЛОКА

      // Основная обработка сообщения (после идентификации клиента)
      state.history.push({ role: 'user', content: userMessage, timestamp: new Date() });
      
      const orderResponse = this.handleOrderQuery(userMessage, state);
      if (orderResponse) {
        state.history.push({ role: 'assistant', content: orderResponse, timestamp: new Date() });
        sessions.set(sessionId, state);
        return orderResponse;
      }
      
      this.detectStageTransition(userMessage, state);

      const relevantExamples = this.findRelevantExamples(userMessage, 3);
      
      if (state.stage === 'solution' && !state.ticketId) {
        state.ticketId = `TICKET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      const historyText = state.history.slice(-8)
        .map(m => `${m.role === 'user' ? 'Клиент' : 'Александр'}: ${m.content}`)
        .join('\n');

      const temperature = state.stage === 'solution' ? 0.3 : 0.7;

      const systemPrompt = `Ты — Александр, специалист техподдержки.

ПРАВИЛА:
1. Пиши как живой человек, без шаблонов и смайликов
2. Короткие предложения. 2-4 предложения максимум
3. Если не знаешь ответа — скажи честно
4. Обращайся к клиенту по имени

## ПРИМЕРЫ:
${relevantExamples.map(ex => 
  `Клиент: ${ex.instruction_ru}\nАлександр: ${ex.response_ru}`
).join('\n\n')}

## КЛИЕНТ:
Имя: ${state.clientName || 'не известно'}
Этап: ${state.stage}

## ИСТОРИЯ:
${historyText}

Сейчас ответь клиенту (только ответ):`;

      const response = await this.gigachat.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ], temperature);

      state.history.push({ role: 'assistant', content: response, timestamp: new Date() });
      sessions.set(sessionId, state);

      logger.info(`Stage: ${state.stage} | Session: ${sessionId}`);

      return response;

    } catch (error) {
      logger.error('Agent error:', error);
      return this.getFallbackResponse();
    }
  }

  private getFallbackResponse(): string {
    return 'Извините, сейчас технические проблемы. Попробуйте позже.';
  }
}