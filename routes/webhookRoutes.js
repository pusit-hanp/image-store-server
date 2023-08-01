import express from 'express';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { db } from '../db.js';

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
  '/',
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

function createAttachments(imagePaths) {
  return imagePaths.map((path) => {
    return {
      filename: path,
      path: `${process.env.SERVER_URL}${process.env.IMAGE_RAW}${path}`,
    };
  });
}

export default router;
