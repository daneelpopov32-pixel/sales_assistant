"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDatabase = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = __importDefault(require("./logger"));
class OrderDatabase {
    orders = [];
    customers = [];
    constructor() {
        this.loadOrders();
        this.loadCustomers();
    }
    loadOrders() {
        try {
            const ordersPath = path.join(process.cwd(), 'data', 'orders.json');
            if (fs.existsSync(ordersPath)) {
                const data = fs.readFileSync(ordersPath, 'utf-8');
                this.orders = JSON.parse(data);
                logger_1.default.info(`📦 Загружено ${this.orders.length} заказов`);
            }
            else {
                logger_1.default.warn('⚠️ Файл orders.json не найден');
            }
        }
        catch (error) {
            logger_1.default.error('Ошибка загрузки заказов:', error);
        }
    }
    loadCustomers() {
        try {
            const customersPath = path.join(process.cwd(), 'data', 'customers.json');
            if (fs.existsSync(customersPath)) {
                const data = fs.readFileSync(customersPath, 'utf-8');
                this.customers = JSON.parse(data);
                logger_1.default.info(`👥 Загружено ${this.customers.length} клиентов`);
            }
            else {
                logger_1.default.warn('⚠️ Файл customers.json не найден');
            }
        }
        catch (error) {
            logger_1.default.error('Ошибка загрузки клиентов:', error);
        }
    }
    findCustomerByContact(contact) {
        const clean = contact.trim().toLowerCase();
        const customer = this.customers.find(c => c.email?.toLowerCase() === clean ||
            c.phone_number?.replace(/\D/g, '') === clean.replace(/\D/g, ''));
        if (customer) {
            logger_1.default.info(`✅ Найден клиент: ${customer.first_name} ${customer.last_name}`);
        }
        else {
            logger_1.default.info(`❌ Клиент не найден по контакту: ${contact}`);
        }
        return customer || null;
    }
    getOrdersByCustomerId(customerId) {
        return this.orders.filter(o => o.customer_id?.toLowerCase() === customerId.toLowerCase());
    }
    // ➕ Новый метод: получить количество заказов по контакту (email или телефон)
    getOrderCountByContact(contact) {
        const customer = this.findCustomerByContact(contact);
        if (!customer)
            return 0;
        const orders = this.getOrdersByCustomerId(customer.customer_id);
        return orders.length;
    }
    // ➕ Новый метод: получить общую сумму заказов по контакту
    getTotalSpentByContact(contact) {
        const customer = this.findCustomerByContact(contact);
        if (!customer)
            return 0;
        const orders = this.getOrdersByCustomerId(customer.customer_id);
        return orders.reduce((sum, o) => sum + parseFloat(o.order_amount || '0'), 0);
    }
    getCustomerStats(customerId) {
        const orders = this.getOrdersByCustomerId(customerId);
        const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.order_amount || '0'), 0);
        const statuses = {};
        orders.forEach(o => { statuses[o.status] = (statuses[o.status] || 0) + 1; });
        const lastOrder = orders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())[0] || null;
        return { totalOrders: orders.length, totalSpent, statuses, lastOrder };
    }
    formatCustomerStats(customer, customerId) {
        const stats = this.getCustomerStats(customerId);
        const statusRu = {
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
    getOrderById(orderId) {
        const clean = orderId.trim().toLowerCase();
        const order = this.orders.find(o => o.order_id.toLowerCase() === clean ||
            o.order_id.toLowerCase().startsWith(clean));
        if (order)
            logger_1.default.info(`✅ Найден заказ: ${order.order_id}`);
        else
            logger_1.default.info(`❌ Заказ не найден: ${clean}`);
        return order || null;
    }
    formatOrderInfo(order) {
        const statusRu = {
            'success': 'Выполнен', 'refunded': 'Возврат средств',
            'fail': 'Ошибка оплаты', 'failed': 'Ошибка оплаты',
        };
        const paymentRu = {
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
exports.OrderDatabase = OrderDatabase;
//# sourceMappingURL=orderDatabase.js.map