import express from 'express';
import admin from '../firebase.js'; // Assuming firebase.js is in the parent directory
import { db } from '../db.js'; // Assuming db.js contains the database connection logic

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

export default router;