import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import admin from './firebase.js';
import { db, connectToDb } from './db.js';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import imageRoutes from './routes/imageRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

const PORT = process.env.PORT || 8080;

// Middleware setup
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://image-store-app.onrender.com'],
  })
);

// Static Files Middleware
app.use(express.static('public'));

// This is a public sample test API key.
// Don’t submit any personally identifiable information in requests made with this key.
// Sign in to see your own test API key embedded in code samples.
const stripe = new Stripe(process.env.STRIPE_S_KEYS);

//Stripe webhook
const endpointSecret = process.env.STRIPE_WEBHOOK;
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
      console.log('Webhook verified');
    } catch (err) {
      console.log(`Webhook error: ${err.message}`);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    let email;
    let status = 'Completed';
    let transId;

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;
        //console.log("Payment intent");
        //console.log(event.data.object.id);
        //console.log(paymentIntentSucceeded);
        break;
      case 'checkout.session.completed':
        const checkoutSessionCompleted = event.data.object;
        //console.log("Checkout session completed");
        //console.log(checkoutSessionCompleted);
        email = checkoutSessionCompleted.customer_details.email;
        transId = checkoutSessionCompleted.id;
        //console.log("transId");
        //console.log(transId);
        await db.collection('transactions').findOneAndUpdate(
          { transactionId: transId },
          {
            $set: {
              ...(email && { email }),
              ...(status && { status }),
            },
          },
          { returnOriginal: false }
        );
        break;
      default:
        console.log('default');
        console.log(`Unhandled event type ${event.type}`);
    }
    response.send();
  }
);

app.post('/api/payment/create-checkout-session', async (req, res) => {
  const { product } = req.body;

  const lineItems = product.map((image) => {
    return {
      price_data: {
        currency: 'cad',
        unit_amount: Math.round(image.price * 100),
        product_data: {
          name: image.title,
          description: image.description,
          images: [image.imageLocation],
        },
      },
      quantity: 1,
    };
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url:
      process.env.NODE_ENV === 'production'
        ? `https://image-store-app.onrender.com/success`
        : `http://localhost:3000/success`,
    cancel_url:
      process.env.NODE_ENV === 'production'
        ? `https://image-store-app.onrender.com/cancel`
        : `http://localhost:3000/cancel`,
  });

  const imageIDs = product.map((item) => new ObjectId(item._id));

  const newTransaction = {
    transactionId: session.id,
    price: parseFloat(session.amount_subtotal / 100),
    date: new Date(),
    purchasedImages: imageIDs,
    status: 'pending payment',
  };
  await db.collection('transactions').insertOne(newTransaction);

  res.json({ id: session.id });
});

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
