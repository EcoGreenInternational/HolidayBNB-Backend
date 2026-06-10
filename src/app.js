import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import adminPropertyRoutes from './routes/adminPropertyRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

app.use(helmet());

app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}


app.use(rateLimit({
  windowMs: 15 * 60 * 1000, 
  max:      100,
  message:  { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders:   false,
}));


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many auth attempts, try again in 15 minutes' },
});


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HollyBnB API is running',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

app.use('/api/auth',  authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties',  propertyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/properties', adminPropertyRoutes);
app.use('/api/admin/upload', uploadRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
