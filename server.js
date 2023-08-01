import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import admin from './firebase.js';
import { db, connectToDb } from './db.js';

import userRoutes from './routes/userRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

const app = express();

const PORT = process.env.PORT || 8080;

app.use('/api/webhook', webhookRoutes);

// Middleware setup
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://image-store-app.onrender.com'],
  })
);

// Static Files Middleware
app.use(express.static('public'));

// Verify Firebase authtoken Middleware
app.use(async (req, res, next) => {
  const { authtoken } = req.headers;

  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      return res.sendStatus(400);
    }
  }

  req.user = req.user || {};

  next();
});

// Route setup
app.use('/api/images', imageRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payment', paymentRoutes);

// Error handling middleware (optional)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

connectToDb(() => {
  console.log('Successfully Connect to Database');
  app.listen(PORT, () => {
    console.log('Server is listening on port ' + PORT);
  });
});
