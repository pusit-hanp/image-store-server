import express from 'express';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import path from 'path';
import { db } from '../configs/db.js';
import admin from '../configs/firebase.js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_S_KEYS);

// This is a public sample test API key.
// Don’t submit any personally identifiable information in requests made with this key.
// Sign in to see your own test API key embedded in code samples.

router.post('/create-checkout-session', async (req, res) => {
  const { imageIds, email } = req.body;
  const { authtoken } = req.headers;

  const images = await db
    .collection('images')
    .find({ _id: { $in: imageIds.map((id) => new ObjectId(id)) } })
    .toArray();

  const lineItems = images.map((image) => {
    const imageURL = `https://image-store-app-api.onrender.com/images/wm/${path.basename(
      image.watermarkedLocation
    )}`;
    return {
      price_data: {
        currency: 'cad',
        unit_amount: Math.round(image.price * 100),
        product_data: {
          name: image.title,
          description: image.description,
          images: [imageURL],
        },
      },
      quantity: 1,
    };
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    success_url:
      process.env.NODE_ENV === 'production'
        ? `https://image-store-app.onrender.com/success`
        : `http://localhost:3000/success`,
    cancel_url:
      process.env.NODE_ENV === 'production'
        ? `https://image-store-app.onrender.com/cancel`
        : `http://localhost:3000/cancel`,
  });

  const newTransaction = {
    transactionId: session.id,
    price: parseFloat(session.amount_subtotal / 100),
    date: new Date(),
    purchasedImages: imageIds.map((id) => new ObjectId(id)),
    status: 'pending payment',
    email: email,
  };
  const transaction = await db
    .collection('transactions')
    .insertOne(newTransaction);

  if (authtoken) {
    try {
      const firebaseUser = await admin.auth().verifyIdToken(authtoken);
      await db
        .collection('users')
        .findOneAndUpdate(
          { uid: firebaseUser.uid },
          { $push: { transactions: transaction.insertedId } }
        );
    } catch (e) {
      return res.sendStatus(400);
    }
  }

  res.json({ id: session.id });
});

export default router;
