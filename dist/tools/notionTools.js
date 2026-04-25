"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionDatabase = void 0;
const client_1 = require("@notionhq/client");
const config_1 = require("../config");
const logger_1 = __importDefault(require("./logger"));
class NotionDatabase {
    notion;
    constructor() {
        if (!config_1.config.notion.apiKey) {
            throw new Error('NOTION_API_KEY is not configured');
        }
        this.notion = new client_1.Client({ auth: config_1.config.notion.apiKey });
        logger_1.default.info('Notion client initialized');
    }
    async searchProducts(query, limit = 5) {
        try {
            if (!config_1.config.notion.productsDbId) {
                logger_1.default.warn('Products database ID not configured');
                return [];
            }
            logger_1.default.info(`Searching products with query: "${query}"`);
            const response = await this.notion.databases.query({
                database_id: config_1.config.notion.productsDbId,
                filter: {
                    or: [
                        {
                            property: 'Name',
                            title: {
                                contains: query,
                            },
                        },
                        {
                            property: 'Description',
                            rich_text: {
                                contains: query,
                            },
                        },
                    ],
                },
                page_size: limit,
            });
            const products = response.results.map(page => {
                const props = page.properties;
                return {
                    id: page.id,
                    name: props.Name?.title?.[0]?.plain_text || 'Без названия',
                    price: props.Price?.number || 0,
                    stock: props.Stock?.number || 0,
                    description: props.Description?.rich_text?.[0]?.plain_text || '',
                };
            });
            logger_1.default.info(`Found ${products.length} products`);
            return products;
        }
        catch (error) {
            logger_1.default.error('Notion search failed:', error);
            return [];
        }
    }
}
exports.NotionDatabase = NotionDatabase;
//# sourceMappingURL=notionTools.js.map