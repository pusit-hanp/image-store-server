import express from 'express';
import multer from 'multer';
import path from 'path';
import { ObjectId } from 'mongodb';
import { db } from '../db.js'; // Assuming db.js contains the database connection logic

const router = express.Router();

// Route for getting all images
router.get('/', async (req, res) => {
  console.log(req.query);
  // Extract the query parameters
  const currentPage = req.query.page;
  const imagesPerPage = req.query.perPage;
  const isAll = req.query.status === 'All';
  const category = req.query.cat;

  const indexOfLastItem = currentPage * imagesPerPage;
  const indexOfFirstItem = indexOfLastItem - imagesPerPage;
  try {
    // Get images imformation from database
    let images;

    if (isAll && !category) {
      images = await db.collection('images').find().toArray();
    } else if (isAll && category) {
      images = await db
        .collection('images')
        .find({ tags: { $in: [category] } })
        .toArray();
    } else if (!isAll && category) {
      // if not all Get only Active images from database
      images = await db
        .collection('images')
        .find({ status: 'Active', tags: { $in: [category] } })
        .toArray();
    } else {
      // if not all and no category Get only Active images from database
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
      const imageURL = `https://image-store-app-api.onrender.com/images/wm/${path.basename(
        item.watermarkedLocation
      )}`;
      console.log(imageURL);
      const returnImage = {
        _id: item._id,
        title: item.title,
        description: item.description,
        seller: item.seller,
        likes: item.likes,
        views: item.views,
        status: item.status,
        imageLocation: imageURL,
        tags: item.tags,
        price: item.price,
      };
      return returnImage;
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

router.get('/:imageId', async (req, res) => {
  // Extract the body parameters
  const { imageId } = req.params;

  // get selected image information from database
  const id = new ObjectId(imageId);
  const image = await db.collection('images').findOne({ _id: id });
  console.log(image);

  if (image) {
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

    // return images
    res.json({ image: returnImage });
  } else {
    res.sendStatus(404);
  }
});

router.post('/update', async (req, res) => {
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

// Set up multer disk storage for image uploads
const storage = multer.diskStorage({
  destination: path.resolve('public/images/raws'), // Use path.resolve() to create an absolute path
  filename: function (req, file, cb) {
    console.log(req.body);
    const uniqueSuffix =
      Date.now() + '-' + Math.floor(1e3 + Math.random() * 9 * 1e3);
    cb(null, 'OR' + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const watermarkText = 'Image Store';
const watermarkFontSize = 40;
const watermarkOffsetY = 50;

const addWatermark = async (
  image,
  watermarkText,
  font,
  positionX,
  positionY
) => {
  const centerX = image.bitmap.width / 2 + positionX;
  const centerY = image.bitmap.height / 2 + positionY;
  image.print(
    font,
    centerX,
    centerY,
    watermarkText,
    Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE
  );
};

router.post(
  '/upload',
  upload.single('imageFile'),
  async function (req, res, next) {
    try {
      // console.log(req.file); // Check if the file details are logged correctly
      // console.log(req.body); // Check other form fields

      // Get the uploaded image file path
      const imageFilePath = req.file.path;
      const originalImageName = req.file.filename;
      const originalImageExt = path.extname(originalImageName);

      // Generate the watermarked image and save it to /public/images/WM
      const watermarkedFileName = `WM-${Date.now()}-${Math.floor(
        1e3 + Math.random() * 9 * 1e3
      )}${originalImageExt}`;
      const watermarkedFilePath = path.resolve(
        'public/images/wm',
        watermarkedFileName
      );
      // Read the input image using Jimp
      const image = await Jimp.read(imageFilePath);

      // Calculate the aspect ratio of the original image
      const aspectRatio = image.bitmap.width / image.bitmap.height;

      // Calculate the new width and height to fit inside a 600 by 600 box while maintaining aspect ratio
      let newWidth, newHeight;
      if (aspectRatio >= 1) {
        // Landscape or square image
        newWidth = 600;
        newHeight = 600 / aspectRatio;
      } else {
        // Portrait image
        newWidth = 600 * aspectRatio;
        newHeight = 600;
      }

      // Resize the image to fit inside the 800 by 800 box
      image.resize(newWidth, newHeight, Jimp.RESIZE_INSIDE);

      // Load the font for watermark text
      const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

      // Add the main watermark at the center of the image
      const hundred = 100;
      addWatermark(image, watermarkText, font, 0, 0);

      // Add watermarks at different positions
      addWatermark(image, watermarkText, font, 0, 0);
      addWatermark(image, watermarkText, font, 1 * hundred, 1 * hundred);
      addWatermark(image, watermarkText, font, -1 * hundred, -1 * hundred);
      addWatermark(image, watermarkText, font, -1 * hundred, 1 * hundred);
      addWatermark(image, watermarkText, font, 1 * hundred, -1 * hundred);
      addWatermark(image, watermarkText, font, 2 * hundred, 2 * hundred);
      addWatermark(image, watermarkText, font, -2 * hundred, -2 * hundred);
      addWatermark(image, watermarkText, font, -2 * hundred, 2 * hundred);
      addWatermark(image, watermarkText, font, 2 * hundred, -2 * hundred);
      addWatermark(image, watermarkText, font, 3 * hundred, 3 * hundred);
      addWatermark(image, watermarkText, font, -3 * hundred, -3 * hundred);
      addWatermark(image, watermarkText, font, -3 * hundred, 3 * hundred);
      addWatermark(image, watermarkText, font, 3 * hundred, -3 * hundred);
      addWatermark(image, watermarkText, font, 2 * hundred, 0);
      addWatermark(image, watermarkText, font, -2 * hundred, 0);
      addWatermark(image, watermarkText, font, 0, 2 * hundred);
      addWatermark(image, watermarkText, font, 0, -2 * hundred);
      addWatermark(image, watermarkText, font, -3 * hundred, 1 * hundred);
      addWatermark(image, watermarkText, font, -3 * hundred, -1 * hundred);
      addWatermark(image, watermarkText, font, -1 * hundred, 3 * hundred);
      addWatermark(image, watermarkText, font, 1 * hundred, 3 * hundred);
      addWatermark(image, watermarkText, font, 3 * hundred, 1 * hundred);
      addWatermark(image, watermarkText, font, 3 * hundred, -1 * hundred);
      addWatermark(image, watermarkText, font, 1 * hundred, -3 * hundred);
      addWatermark(image, watermarkText, font, -1 * hundred, 3 * hundred);
      // Save the watermarked image
      await image.writeAsync(watermarkedFilePath);

      // Save image details to MongoDB
      const imageDetails = {
        title: req.body.title,
        description: req.body.description,
        seller: '', // Seller information here
        likes: 0, // Initialize the likes to 0
        views: 0, // Initialize the views to 0
        status: 'Active', // Assuming the default status is 'Available'
        // imageLocation: req.file.path, // Using absolute path
        imageLocation: `./images/raws/${req.file.filename}`, // Using relative path
        watermarkedLocation: `./images/wm/${watermarkedFileName}`, // Using relative path for watermarked image
        //watermarkedName: watermarkedFileName, // Store watermarked filename separately
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

export default router;
