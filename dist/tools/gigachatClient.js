"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GigaChatClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("./logger"));
class GigaChatClient {
    accessToken = null;
    tokenExpiry = null;
    httpsAgent = new https_1.default.Agent({ rejectUnauthorized: false });
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
    async authenticate() {
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.accessToken;
        }
        try {
            const response = await axios_1.default.post('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', `scope=${config_1.config.gigachat.scope}`, {
                headers: {
                    'Authorization': `Bearer ${config_1.config.gigachat.authKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'RqUID': this.generateUUID(),
                },
                httpsAgent: this.httpsAgent,
            });
            this.accessToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 1800;
            this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
            logger_1.default.info('GigaChat authenticated successfully');
            if (!this.accessToken)
                throw new Error('Failed to get access token');
            return this.accessToken;
        }
        catch (error) {
            logger_1.default.error('GigaChat authentication failed:', error);
            throw new Error('Failed to authenticate with GigaChat');
        }
    }
    async chat(messages, temperature = 0.7) {
        try {
            const token = await this.authenticate();
            const response = await axios_1.default.post('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', { model: 'GigaChat', messages, temperature, max_tokens: 500 }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                httpsAgent: this.httpsAgent,
            });
            return response.data.choices[0].message.content;
        }
        catch (error) {
            logger_1.default.error('GigaChat chat failed:', error);
            return 'Извините, временно не могу ответить. Попробуйте позже.';
        }
    }
}
exports.GigaChatClient = GigaChatClient;
//# sourceMappingURL=gigachatClient.js.map