import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import logger from './tools/logger';
import { SupportAgent } from './agents/supportAgent';
import { WebhookRequest, WebhookResponse } from './types';

const app = express();
const agent = new SupportAgent();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'support-assistant'
  });
});

app.post('/webhook/max', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { sessionId, message, userId, userName } = req.body as WebhookRequest;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }
    logger.info(`Processing message for session ${sessionId}`, { userId, userName, message });
    const response = await agent.processMessage(sessionId, message);
    const duration = Date.now() - startTime;
    logger.info(`Message processed in ${duration}ms for session ${sessionId}`);
    return res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(config.port, () => {
  logger.info(`🛟 Support Assistant running on port ${config.port}`);
  logger.info(`   Health check: http://localhost:${config.port}/health`);
  logger.info(`   Webhook: http://localhost:${config.port}/webhook/max`);
});