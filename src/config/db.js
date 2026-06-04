import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    logger.error('MONGO_URI is not defined. Add it to your .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected, retrying...'));
  mongoose.connection.on('reconnected',  () => logger.info('MongoDB reconnected'));

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB closed on app shutdown');
    process.exit(0);
  });
};

export default connectDB;
