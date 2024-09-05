const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');

require('dotenv').config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'fasefraw4r5r3wq45wdfgw34twdfg';
const bucket = 'dawid-booking-app';

// Connect to MongoDB once at the start of the app
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
  credentials: true,
  origin: process.env.FRONTEND_URL || 'https://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app',
}));

// AWS S3 Upload Function
async function uploadToS3(path, originalFilename, mimetype) {
  const client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  const ext = originalFilename.split('.').pop();
  const newFilename = `${Date.now()}.${ext}`;
  const fileStream = fs.readFileSync(path);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Body: fileStream,
    Key: newFilename,
    ContentType: mimetype,
    ACL: 'public-read',
  }));

  return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

// Helper to get user data from request token
function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, (err, userData) => {
      if (err) {
        reject('Invalid token');
      } else {
        resolve(userData);
      }
    });
  });
}

// Routes

app.get('/api/test', (req, res) => {
  res.json('test ok');
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });

  if (!userDoc) {
    return res.status(404).json('User not found');
  }

  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({ email: userDoc.email, id: userDoc._id }, jwtSecret, {}, (err, token) => {
      if (err) {
        return res.status(500).json('Error generating token');
      }
      res.cookie('token', token).json(userDoc);
    });
  } else {
    res.status(422).json('Incorrect password');
  }
});

app.get('/api/profile', async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    try {
      const userData = await getUserDataFromReq(req);
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    } catch (err) {
      res.status(401).json('Token error');
    }
  } else {
    res.json(null);
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '').json(true);
});

app.post('/api/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = `photo${Date.now()}.jpg`;
  try {
    await imageDownloader.image({
      url: link,
      dest: `/tmp/${newName}`,
    });
    const url = await uploadToS3(`/tmp/${newName}`, newName, mime.lookup(`/tmp/${newName}`));
    res.json(url);
  } catch (err) {
    res.status(500).json('Image download failed');
  }
});

const photosMiddleware = multer({ dest: '/tmp' });
app.post('/api/upload', photosMiddleware.array('photos', 100), async (req, res) => {
  try {
    const uploadedFiles = [];
    for (const file of req.files) {
      const { path, originalname, mimetype } = file;
      const url = await uploadToS3(path, originalname, mimetype);
      uploadedFiles.push(url);
    }
    res.json(uploadedFiles);
  } catch (err) {
    res.status(500).json('Upload failed');
  }
});

app.post('/api/places', async (req, res) => {
  const { token } = req.cookies;
  const { title, address, addedPhotos, description, price, perks, extraInfo, checkIn, checkOut, maxGuests } = req.body;
  try {
    const userData = await getUserDataFromReq(req);
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      price,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
    });
    res.json(placeDoc);
  } catch (err) {
    res.status(400).json('Error creating place');
  }
});

app.get('/api/user-places', async (req, res) => {
  const { token } = req.cookies;
  try {
    const userData = await getUserDataFromReq(req);
    const places = await Place.find({ owner: userData.id });
    res.json(places);
  } catch (err) {
    res.status(400).json('Error fetching user places');
  }
});

app.get('/api/places/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const place = await Place.findById(id);
    res.json(place);
  } catch (err) {
    res.status(400).json('Place not found');
  }
});

app.put('/api/places', async (req, res) => {
  const { token } = req.cookies;
  const { id, title, address, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body;
  try {
    const userData = await getUserDataFromReq(req);
    const placeDoc = await Place.findById(id);
    if (placeDoc.owner.toString() === userData.id) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json('Place updated');
    } else {
      res.status(403).json('Unauthorized');
    }
  } catch (err) {
    res.status(400).json('Error updating place');
  }
});

app.get('/api/places', async (req, res) => {
  try {
    const places = await Place.find();
    res.json(places);
  } catch (err) {
    res.status(400).json('Error fetching places');
  }
});

app.post('/api/bookings', async (req, res) => {
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } = req.body;
  try {
    const userData = await getUserDataFromReq(req);
    const bookingDoc = await Booking.create({
      place,
      checkIn,
      checkOut,
      numberOfGuests,
      name,
      phone,
      price,
      user: userData.id,
    });
    res.json(bookingDoc);
  } catch (err) {
    res.status(500).json('Error creating booking');
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const userData = await getUserDataFromReq(req);
    const bookings = await Booking.find({ user: userData.id }).populate('place');
    res.json(bookings);
  } catch (err) {
    res.status(500).json('Error fetching bookings');
  }
});

app.listen(4000, () => {
  console.log('Server running on port 4000');
});
