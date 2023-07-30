import express from 'express';
import admin from '../firebase.js';
import { db } from '../db.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Route for user registration
router.post('/register', async (req, res) => {
  try {
    // Create a new Firebase user
    const { email, password, firstName, lastName, phone, address } = req.body;
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
    });

    // Create a new user document
    const user = {
      uid: firebaseUser.uid,
      email,
      firstName,
      lastName,
      phone,
      address,
      role: 'user',
      cart: [],
      likes: [],
      transactions: [],
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
router.get('/:uid', async (req, res) => {
  try {
    // Search user information in Database from firebase uid
    const uid = req.params.uid;
    const user = await db.collection('users').findOne({ uid });

    // Create a new user collection
    if (user) {
      // get images infromation in user cart from database
      const cartObjects = await db
        .collection('images')
        .find({ _id: { $in: user.cart.map((id) => new ObjectId(id)) } })
        .toArray();
      // set format of user cart
      cartObjects = cartObjects.map((image) => {
        const imageURL = `https://image-store-app-api.onrender.com/images/wm/${path.basename(
          image.watermarkedLocation
        )}`;
        const returnImage = {
          _id: image._id,
          title: image.title,
          description: image.description,
          seller: image.seller,
          likes: image.likes,
          views: image.views,
          status: image.status,
          imageLocation: imageURL,
          tags: image.tags,
          price: image.price,
        };
        return returnImage;
      });

      // get images infromation in user likes from database
      const likeObjects = await db
        .collection('images')
        .find({ _id: { $in: user.likes.map((id) => new ObjectId(id)) } })
        .toArray();
      // set format of user likes
      likeObjects = likeObjects.map((image) => {
        const imageURL = `https://image-store-app-api.onrender.com/images/wm/${path.basename(
          image.watermarkedLocation
        )}`;
        const returnImage = {
          _id: image._id,
          title: image.title,
          description: image.description,
          seller: image.seller,
          likes: image.likes,
          views: image.views,
          status: image.status,
          imageLocation: imageURL,
          tags: image.tags,
          price: image.price,
        };
        return returnImage;
      });

      const transactionObjects = await db
        .collection('transactions')
        .find({ _id: { $in: user.transactions.map((id) => new ObjectId(id)) } })
        .toArray();

      const currentUser = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        cart: cartObjects,
        likes: likeObjects,
        transactions: transactionObjects,
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

// Route for updating user information
router.post('/update', async (req, res) => {
  try {
    // verify user, The UID is attached by the authentication middleware
    const { uid } = req.user;

    // Extract the body parameters
    const {
      email,
      firstName,
      lastName,
      phone,
      address,
      cart,
      transactions,
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
          cart: cart.map((image) => new ObjectId(image._id)),
          likes: likes.map((image) => new ObjectId(image._id)),
          transactions: transactions.map(
            (transaction) => new ObjectId(transaction._id)
          ),
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

export default router;
