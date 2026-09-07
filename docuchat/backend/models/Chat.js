const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['local', 'research', 'huggingface'] },
  content: String, // extracted text
  source: String,  // URL or filename
  uploadedAt: { type: Date, default: Date.now }
});

const vectorChunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  source: String,
  docType: String
}, { _id: false });

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  messages: [messageSchema],
  documents: [documentSchema],
  vectorChunks: { type: [vectorChunkSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

chatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.messages.length > 0 && this.title === 'New Chat') {
    const firstMsg = this.messages[0].content;
    this.title = firstMsg.substring(0, 50) + (firstMsg.length > 50 ? '...' : '');
  }
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
