"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const logger_1 = __importDefault(require("./tools/logger"));
const supportAgent_1 = require("./agents/supportAgent");
const app = (0, express_1.default)();
const agent = new supportAgent_1.SupportAgent();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    logger_1.default.info(`${req.method} ${req.path}`);
    next();
});
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'support-assistant'
    });
});
app.post('/webhook/max', async (req, res) => {
    const startTime = Date.now();
    try {
        const { sessionId, message, userId, userName } = req.body;
        if (!sessionId || !message) {
            return res.status(400).json({ error: 'sessionId and message are required' });
        }
        logger_1.default.info(`Processing message for session ${sessionId}`, { userId, userName, message });
        const response = await agent.processMessage(sessionId, message);
        const duration = Date.now() - startTime;
        logger_1.default.info(`Message processed in ${duration}ms for session ${sessionId}`);
        return res.json({ response, timestamp: new Date().toISOString() });
    }
    catch (error) {
        logger_1.default.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
app.listen(config_1.config.port, () => {
    logger_1.default.info(`🛟 Support Assistant running on port ${config_1.config.port}`);
    logger_1.default.info(`   Health check: http://localhost:${config_1.config.port}/health`);
    logger_1.default.info(`   Webhook: http://localhost:${config_1.config.port}/webhook/max`);
});
//# sourceMappingURL=index.js.map