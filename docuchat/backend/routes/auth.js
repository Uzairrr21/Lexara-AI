const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Euclidean distance for face descriptor comparison
function faceDistance(d1, d2) {
  if (!d1 || !d2 || d1.length !== d2.length) return Infinity;
  return Math.sqrt(d1.reduce((sum, v, i) => sum + Math.pow(v - d2[i], 2), 0));
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, faceDescriptor } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = new User({
      name,
      email,
      password: password || undefined,
      faceDescriptor: faceDescriptor || null,
      hasFaceAuth: !!faceDescriptor
    });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, hasFaceAuth: user.hasFaceAuth }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, hasFaceAuth: user.hasFaceAuth }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/face-login
router.post('/face-login', async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ message: 'Face descriptor required' });
    }

    const users = await User.find({ hasFaceAuth: true });
    let matchedUser = null;
    let minDist = Infinity;

    for (const user of users) {
      const dist = faceDistance(user.faceDescriptor, faceDescriptor);
      if (dist < minDist) {
        minDist = dist;
        matchedUser = user;
      }
    }

    const THRESHOLD = 0.5;
    if (!matchedUser || minDist > THRESHOLD) {
      return res.status(401).json({ message: 'Face not recognized. Please register first.' });
    }

    const token = generateToken(matchedUser._id);
    res.json({
      token,
      user: { id: matchedUser._id, name: matchedUser.name, email: matchedUser.email, hasFaceAuth: matchedUser.hasFaceAuth },
      distance: minDist
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/update-face
router.post('/update-face', authMiddleware, async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!faceDescriptor) return res.status(400).json({ message: 'Descriptor required' });

    await User.findByIdAndUpdate(req.user._id, {
      faceDescriptor,
      hasFaceAuth: true
    });
    res.json({ message: 'Face updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
