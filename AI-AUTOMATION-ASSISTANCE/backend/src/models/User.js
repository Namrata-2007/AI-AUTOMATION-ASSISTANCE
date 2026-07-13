const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  picture: String,
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  preferences: {
    defaultTone: {
      type: String,
      enum: ['formal', 'friendly', 'professional', 'casual'],
      default: 'professional'
    },
    defaultLanguage: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    signature: String
  },
  aiUsage: {
    totalGenerations: {
      type: Number,
      default: 0
    },
    lastGenerated: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);