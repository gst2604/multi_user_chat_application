const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  message: String,
  type: {
    type: String,
    enum: ['text', 'image', 'voice'],
    default: 'text'
  },
  fileUrl: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
