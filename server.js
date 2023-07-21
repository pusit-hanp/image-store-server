import fs from 'fs';
import admin from 'firebase-admin';
import express from 'express';
import 'dotenv/config';
import { db, connectToDb } from './db.js';
import Stripe from 'stripe';
import path from 'path';
import { ObjectId } from 'mongodb';
import cors from 'cors';
import multer from 'multer';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

// initialize firebase
// const credentials = JSON.parse(fs.readFileSync('./credentials.json'));
const credentials = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(credentials),
});

const app = express();

// This is a public sample test API key.
// Don’t submit any personally identifiable information in requests made with this key.
// Sign in to see your own test API key embedded in code samples.
const stripe = new Stripe(process.env.STRIPE_S_KEYS);

app.use(express.static('public'));
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://image-store-app.onrender.com'],
  })
);

// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../client/build')));

//   app.get(/^(?!\/api).+/, (req, res) => {
//     res.sendFile(path.join(__dirname, '../client/build/index.html'));
//   });
// }
// Serve static files from the "images" directory
//app.use('/images', express.static(path.join(__dirname, '../public/images')));

const storage = multer.diskStorage({
  destination: path.resolve('public/images/raws'), // Use path.resolve() to create an absolute path
  filename: function (req, file, cb) {
    console.log(req.body);
    const uniqueSuffix = Date.now();
    cb(
      null,
      req.body.title + '-' + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

/////////////////////////////////////////////////////////////////
app.post(
  '/api/image/upload',
  upload.single('imageFile'),
  async function (req, res, next) {
    try {
      // console.log(req.file); // Check if the file details are logged correctly
      // console.log(req.body); // Check other form fields

      // Save image details to MongoDB
      const imageDetails = {
        title: req.body.title,
        description: req.body.description,
        seller: '', // Seller information here
        likes: 0, // Initialize the likes to 0
        views: 0, // Initialize the views to 0
        status: 'Available', // Assuming the default status is 'Available'
        // imageLocation: req.file.path, // Using absolute path
        imageLocation: `./images/raws/${req.file.filename}`, // Using relative path

        dateCreated: new Date(),
        dateEdited: new Date(),
        tags: req.body.tags.split(','), // Convert tags string to an array
        price: parseFloat(req.body.price), // Convert price string to a floating-point number
      };

      //Save the image details to the 'images' collection in MongoDB
      await db.collection('images').insertOne(imageDetails);

      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling image upload:', error.message);
      res.sendStatus(500);
    }
  }
);

// app.post('/test_upload', upload.single('imageFile'), function (req, res, next) {
//   try {
//     console.log(req.file); // Check if the file details are logged correctly
//     console.log(req.body); // Check other form fields
//     res.sendStatus(200);
//   } catch (error) {
//     console.error('Error handling image upload:', error.message);
//     res.sendStatus(500);
//   }
// });

app.post('/api/payment/create-checkout-session', async (req, res) => {
  const { product } = req.body;
  console.log(product);

  // const fp = fs.readFileSync('/images/raws/test.jpg');
  // const upload = await stripe.files.create({
  //   file: {
  //     data: fp,
  //     name: 'file.jpg',
  //     type: 'application.octet-stream',
  //   },
  //   purpose: 'dispute_evidence',
  // });

  // console.log(upload);

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

  console.log(lineItems);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `https://image-store-app.onrender.com/success`,
    cancel_url: `https://image-store-app.onrender.com/cancel`,
  });
  res.json({ id: session.id });
});

// Define a route for handling user registration
app.post('/api/user/register', async (req, res) => {
  console.log(req.body);
  try {
    // Create a new Firebase user
    const firebaseUser = await admin.auth().createUser({
      email: req.body.email,
      password: req.body.password,
    });

    // Create a new user document
    const user = {
      uid: firebaseUser.uid,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      address: req.body.address,
      role: 'user',
      cart: [],
      likes: [],
      transaction: [],
    };

    // Save the user document to the 'users' collection
    await db.collection('users').insertOne(user);

    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'An error occurred while registering the user' });
  }
});

// Define a route for handling user login
app.get('/api/user/:uid', async (req, res) => {
  try {
    // Search user information in Database from firebase uid
    const uid = req.params.uid;
    const user = await db.collection('users').findOne({ uid });

    // Create a new user collection
    if (user) {
      const currentUser = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        cart: user.cart,
        likes: user.likes,
        transaction: user.transaction,
      };

      // return currentUser
      res.status(200).json(currentUser);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: 'An error occurred while fetching user data' });
  }
});

// Define a route for handling get all images
app.get('/api/images', async (req, res) => {
  // Extract the query parameters
  const currentPage = req.query.page;
  const imagesPerPage = req.query.perPage;
  const isAll = req.query.status === 'All';

  const indexOfLastItem = currentPage * imagesPerPage;
  const indexOfFirstItem = indexOfLastItem - imagesPerPage;
  try {
    // Get images imformation from database
    let images;
    if (isAll) {
      images = await db.collection('images').find().toArray();
    } else {
      // if not all Get only Active images from database
      images = await db
        .collection('images')
        .find({ status: 'Active' })
        .toArray();
    }

    // Set currentItems base on imagesPerPage
    let currentItems;
    if (images.length <= imagesPerPage) {
      currentItems = images; // Use all images if there are fewer than imagesPerPage
    } else {
      currentItems = images.slice(indexOfFirstItem, indexOfLastItem);
    }

    // Update imageLocation to the image file path
    currentItems = currentItems.map((item) => {
      const imageURL = `https://image-store-app-api.onrender.com/images/raws/${path.basename(
        item.imageLocation
      )}`;
      return { ...item, imageLocation: imageURL };
    });

    // Calculate totalPages
    const totalPages = Math.ceil(images.length / imagesPerPage);

    // return currentItems and totalPages
    res.json({ images: currentItems, totalPages: totalPages });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'An error occurred while fetching images data' });
  }
});

// Verify firebase authtoken
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

// Define a route for handling update user information
app.post('/api/user/update/', async (req, res) => {
  // verify user
  const { uid } = req.user;

  try {
    // Extract the body parameters
    const {
      email,
      firstName,
      lastName,
      phone,
      address,
      cart,
      transaction,
      likes,
    } = req.body;

    // Update the user document in the MongoDB collection
    const updatedUser = await db.collection('users').findOneAndUpdate(
      { uid: uid }, // Filter criteria
      {
        $set: {
          ...(email & { email }),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phone && { phone }),
          ...(address && { address }),
          ...(cart && { cart }),
          ...(transaction && { transaction }),
          ...(likes && { likes }),
        },
      },
      // Set returnOriginal option to false to get the updated document
      { returnOriginal: false }
    );

    // throws error if updatedUser is null
    if (!updatedUser.value) {
      throw new Error('User not found');
    }

    // Send a successful response
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the user profile');
  }
});

app.get('/api/images/:imageId', async (req, res) => {
  // Extract the body parameters
  const { imageId } = req.params;

  // get selected image information from database
  const id = new ObjectId(imageId);
  const image = await db.collection('images').findOne({ _id: id });

  if (image) {
    const imageURL = `https://image-store-app-api.onrender.com/images/raws/${path.basename(
      image.imageLocation
    )}`;
    console.log(imageURL);
    const updatedImage = { ...image, imageLocation: imageURL };

    // return images
    res.json({ image: updatedImage });
  } else {
    res.sendStatus(404);
  }
});

app.post('/api/images/update', async (req, res) => {
  try {
    // Extract the body parameters
    const { _id, title, description, price, tags, status } = req.body;

    // Update the image document in the MongoDB collection
    await db.collection('images').findOneAndUpdate(
      { _id: new ObjectId(_id) },
      {
        $set: {
          ...(title && { title }),
          ...(description && { description }),
          ...(price && { price }),
          ...(tags && { tags }),
          ...(status && { status }),
          dateEdited: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Send a successful response
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the image');
  }
});

connectToDb(() => {
  console.log('Successfully Connect to Database');
  app.listen(PORT, () => {
    console.log('Server is listening on port ' + PORT);
  });
});
