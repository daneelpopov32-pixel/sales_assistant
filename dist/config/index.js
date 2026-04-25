"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    gigachat: {
        apiUrl: process.env.GIGACHAT_API_URL || 'https://gigachat.devices.sberbank.ru/api/v1',
        authKey: process.env.GIGACHAT_AUTH_KEY,
        scope: process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS',
    },
    notion: {
        apiKey: process.env.NOTION_API_KEY,
        productsDbId: process.env.NOTION_PRODUCTS_DB_ID,
        discountsDbId: process.env.NOTION_DISCOUNTS_DB_ID,
        ordersDbId: process.env.NOTION_ORDERS_DB_ID,
        summariesDbId: process.env.NOTION_SUMMARIES_DB_ID,
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};
// Валидация обязательных переменных
const requiredEnvVars = [
    'GIGACHAT_AUTH_KEY',
    'NOTION_API_KEY',
    'NOTION_PRODUCTS_DB_ID',
    'NOTION_DISCOUNTS_DB_ID',
    'NOTION_ORDERS_DB_ID',
    'NOTION_SUMMARIES_DB_ID',
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map