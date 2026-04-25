import { Client } from '@notionhq/client';
import { config } from '../config';
import logger from './logger';

export class NotionDatabase {
  private notion: Client;

  constructor() {
    if (!config.notion.apiKey) {
      throw new Error('NOTION_API_KEY is not configured');
    }
    this.notion = new Client({ auth: config.notion.apiKey });
    logger.info('Notion client initialized');
  }

  async searchProducts(query: string, limit: number = 5): Promise<any[]> {
    try {
      if (!config.notion.productsDbId) {
        logger.warn('Products database ID not configured');
        return [];
      }

      logger.info(`Searching products with query: "${query}"`);
      
      const response = await this.notion.databases.query({
        database_id: config.notion.productsDbId,
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
        const props = (page as any).properties;
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text || 'Без названия',
          price: props.Price?.number || 0,
          stock: props.Stock?.number || 0,
          description: props.Description?.rich_text?.[0]?.plain_text || '',
        };
      });
      
      logger.info(`Found ${products.length} products`);
      return products;
    } catch (error) {
      logger.error('Notion search failed:', error);
      return [];
    }
  }
}