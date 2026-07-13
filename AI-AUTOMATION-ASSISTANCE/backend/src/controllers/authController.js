const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(config.google.clientId);

exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.google.clientId
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        googleId,
        email,
        name,
        picture,
        preferences: {
          defaultTone: 'professional',
          defaultLanguage: 'en',
          theme: 'light'
        }
      });
      await user.save();
    } else {
      user.googleId = googleId;
      user.picture = picture;
      await user.save();
    }

    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const newToken = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { preferences },
      { new: true }
    ).select('-__v');

    res.json({
      success: true,
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};