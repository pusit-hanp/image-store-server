import express from 'express';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';
import path from 'path';
import { db } from '../db.js';
import admin from '../firebase.js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_S_KEYS);

// Stripe Webhook
const endpointSecret = process.env.STRIPE_WEBHOOK;

const mailSetUp = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'imagecapstone@gmail.com',
    pass: process.env.EMAIL_PASSWORD_NODEMAILER,
  },
  fetch: {
    timeout: 60000,
  },
});

router.post(
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
        //email = checkoutSessionCompleted.customer_details.email;
        transId = checkoutSessionCompleted.id;
        //console.log("transId");
        //console.log(transId);
        const transactionInfo = await db
          .collection('transactions')
          .findOneAndUpdate(
            { transactionId: transId },
            {
              $set: {
                ...(status && { status }),
              },
            },
            { returnOriginal: false }
          );

        const getImagesCursor = db
          .collection('images')
          .find({ _id: { $in: transactionInfo.value.purchasedImages } });
        const getImages = await getImagesCursor.toArray();
        const imagePaths = getImages.map((image) => image.imageLocation);

        const mailData = {
          from: 'imagecapstone@gmail.com',
          to: transactionInfo.value.email,
          subject: 'Image Store Order',
          text: 'Thanks for your order! Enjoy your images',
          attachments: createAttachments(imagePaths),
        };

        //console.log('mailData');
        //console.log(mailData);

        mailSetUp.sendMail(mailData, function (error, info) {
          if (error) {
            console.log('Email error');
            console.log(error);
          } else {
            console.log('Email response: ' + info.response);
          }
        });
        break;
      case 'checkout.session.expired':
        const checkoutSessionExpired = event.data.object;
        console.log('Checkout session expired');
        console.log(checkoutSessionExpired);
        transId = checkoutSessionExpired.id;
        status = 'canceled';
        //console.log("transId");
        //console.log(transId);
        await db.collection('transactions').findOneAndUpdate(
          { transactionId: transId },
          {
            $set: {
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

function createAttachments(imagePaths) {
  return imagePaths.map((path) => {
    return {
      filename: path,
      path: `${process.env.SERVER_URL}${process.env.IMAGE_RAW}${path}`,
    };
  });
}

export default router;
