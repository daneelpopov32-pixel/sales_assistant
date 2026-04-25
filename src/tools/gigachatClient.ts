import axios from 'axios';
import https from 'https';
import { config } from '../config';
import logger from './logger';

export class GigaChatClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private httpsAgent = new https.Agent({ rejectUnauthorized: false });

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }
    try {
      const response = await axios.post(
        'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
        `scope=${config.gigachat.scope}`,
        {
          headers: {
            'Authorization': `Bearer ${config.gigachat.authKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'RqUID': this.generateUUID(),
          },
          httpsAgent: this.httpsAgent,
        }
      );
      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 1800;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
      logger.info('GigaChat authenticated successfully');
      if (!this.accessToken) throw new Error('Failed to get access token');
      return this.accessToken;
    } catch (error) {
      logger.error('GigaChat authentication failed:', error);
      throw new Error('Failed to authenticate with GigaChat');
    }
  }

  async chat(messages: Array<{role: string; content: string}>, temperature: number = 0.7): Promise<string> {
    try {
      const token = await this.authenticate();
      const response = await axios.post(
        'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
        { model: 'GigaChat', messages, temperature, max_tokens: 500 },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        }
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('GigaChat chat failed:', error);
      return 'Извините, временно не могу ответить. Попробуйте позже.';
    }
  }
}