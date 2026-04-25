import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';

// 🔥 ДОБАВЛЕНО: export к интерфейсам
export interface Order {
  order_id: string;
  customer_id: string;
  product_id: string;
  order_amount: string;
  order_date: string;
  payment_method: string;
  status: string;
  quantity: string;
}

export interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  dob: string;
  signup_date: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export class OrderDatabase {
  private orders: Order[] = [];
  private customers: Customer[] = [];

  constructor() {
    this.loadOrders();
    this.loadCustomers();
  }

  private loadOrders(): void {
    try {
      const ordersPath = path.join(process.cwd(), 'data', 'orders.json');
      if (fs.existsSync(ordersPath)) {
        const data = fs.readFileSync(ordersPath, 'utf-8');
        this.orders = JSON.parse(data);
        logger.info(`📦 Загружено ${this.orders.length} заказов`);
      } else {
        logger.warn('⚠️ Файл orders.json не найден');
      }
    } catch (error) {
      logger.error('Ошибка загрузки заказов:', error);
    }
  }

  private loadCustomers(): void {
    try {
      const customersPath = path.join(process.cwd(), 'data', 'customers.json');
      if (fs.existsSync(customersPath)) {
        const data = fs.readFileSync(customersPath, 'utf-8');
        this.customers = JSON.parse(data);
        logger.info(`👥 Загружено ${this.customers.length} клиентов`);
      } else {
        logger.warn('⚠️ Файл customers.json не найден');
      }
    } catch (error) {
      logger.error('Ошибка загрузки клиентов:', error);
    }
  }

  public findCustomerByContact(contact: string): Customer | null {
    const clean = contact.trim().toLowerCase();
    const customer = this.customers.find(c =>
      c.email?.toLowerCase() === clean ||
      c.phone_number?.replace(/\D/g, '') === clean.replace(/\D/g, '')
    );
    if (customer) {
      logger.info(`✅ Найден клиент: ${customer.first_name} ${customer.last_name}`);
    } else {
      logger.info(`❌ Клиент не найден по контакту: ${contact}`);
    }
    return customer || null;
  }

  public getOrdersByCustomerId(customerId: string): Order[] {
    return this.orders.filter(o =>
      o.customer_id?.toLowerCase() === customerId.toLowerCase()
    );
  }

  public getCustomerStats(customerId: string): {
    totalOrders: number;
    totalSpent: number;
    statuses: Record<string, number>;
    lastOrder: Order | null;
  } {
    const orders = this.getOrdersByCustomerId(customerId);
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.order_amount || '0'), 0);
    const statuses: Record<string, number> = {};
    orders.forEach(o => { statuses[o.status] = (statuses[o.status] || 0) + 1; });
    const lastOrder = orders.sort((a, b) =>
      new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    )[0] || null;
    return { totalOrders: orders.length, totalSpent, statuses, lastOrder };
  }

  public formatCustomerStats(customer: Customer, customerId: string): string {
    const stats = this.getCustomerStats(customerId);
    const statusRu: Record<string, string> = {
      'success': 'выполнен', 'refunded': 'возврат', 'fail': 'ошибка', 'failed': 'ошибка',
    };
    const statusText = Object.entries(stats.statuses)
      .map(([s, count]) => `${statusRu[s] || s}: ${count}`)
      .join(', ');
    const lastOrderText = stats.lastOrder
      ? `последний — ${new Date(stats.lastOrder.order_date).toLocaleDateString('ru-RU')} на ${parseFloat(stats.lastOrder.order_amount).toLocaleString('ru-RU')} руб.`
      : 'нет данных';
    return `
Нашёл вас в базе. Добрый день, ${customer.first_name}!

Ваша история заказов:
- Всего заказов: ${stats.totalOrders}
- Потрачено: ${stats.totalSpent.toLocaleString('ru-RU')} руб.
- По статусам: ${statusText || 'нет данных'}
- Последний заказ: ${lastOrderText}

Чем могу помочь?`.trim();
  }

  public getOrderById(orderId: string): Order | null {
    const clean = orderId.trim().toLowerCase();
    const order = this.orders.find(o =>
      o.order_id.toLowerCase() === clean ||
      o.order_id.toLowerCase().startsWith(clean)
    );
    if (order) logger.info(`✅ Найден заказ: ${order.order_id}`);
    else logger.info(`❌ Заказ не найден: ${clean}`);
    return order || null;
  }

  public formatOrderInfo(order: Order): string {
    const statusRu: Record<string, string> = {
      'success': 'Выполнен', 'refunded': 'Возврат средств',
      'fail': 'Ошибка оплаты', 'failed': 'Ошибка оплаты',
    };
    const paymentRu: Record<string, string> = {
      'card': 'Банковская карта', 'paypal': 'PayPal',
      'wallet': 'Электронный кошелек', 'wall-et': 'Электронный кошелек', 'sbp': 'СБП',
    };
    const date = order.order_date ? new Date(order.order_date).toLocaleDateString('ru-RU') : 'не указана';
    const amount = parseFloat(order.order_amount).toLocaleString('ru-RU');
    return `
Заказ ${order.order_id}

Дата: ${date}
Сумма: ${amount} руб.
Оплата: ${paymentRu[order.payment_method] || order.payment_method}
Товаров: ${order.quantity} шт.
Статус: ${statusRu[order.status] || order.status}`.trim();
  }
}