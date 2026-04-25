import dotenv from 'dotenv';

dotenv.config();

export const config = {
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