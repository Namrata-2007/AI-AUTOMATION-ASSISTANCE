const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  company: String,
  position: String,
  phone: String,
  groups: [String],
  notes: String,
  frequency: {
    type: Number,
    default: 0
  },
  lastContacted: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

contactSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);