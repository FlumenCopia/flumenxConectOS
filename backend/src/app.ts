import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes';
import { sendError } from './utils/response';

import publicFormRoutes from './routes/publicFormRoutes';

const app: Application = express();

// Trust reverse proxy (CloudPanel / Nginx) for accurate IP rate limiting & cookies
app.set('trust proxy', 1);

// Enable CORS for frontend client & public website embeds
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, mobile)
      if (!origin) return callback(null, true);
      // In dev or for public routes, allow all or verified origins
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-Requested-With'],
  })
);

import path from 'path';

// Body and Cookie Parsers (supports image and PDF base64 payloads)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Serve static uploads (broadcast media attachments, images, PDFs)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request access logging
app.use(requestLogger);

// Direct Public Form Intake Routing (e.g. /api/public/forms/:publicKey)
app.use('/api/public/forms', publicFormRoutes);

// API v1 Routing
app.use('/api/v1', apiRouter);

// 404 Route Catch-All
app.use((req: Request, res: Response) => {
  sendError(res, `Route '${req.method} ${req.originalUrl}' not found on flumenxConectOS API`, 404);
});

// Global Error Handler Middleware
app.use(errorHandler);

export default app;
