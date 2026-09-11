const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const Chat = require('../models/Chat');
const ragService = require('../services/ragService');
const { traceChat } = require('../services/langfuseService');
const { extractText } = require('../services/extractService');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.md', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, TXT, MD, and DOCX files are allowed'));
  }
});

// GET /api/chats - list all chats for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .select('title createdAt updatedAt documents')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chats - create new chat
router.post('/', authMiddleware, async (req, res) => {
  try {
    const chat = new Chat({ userId: req.user._id, title: 'New Chat', messages: [], documents: [] });
    await chat.save();
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chats/:id - get chat with messages
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Restore persisted vectors after a server restart.
    if (chat.vectorChunks?.length > 0) {
      ragService.restoreIndex(chat._id.toString(), chat.vectorChunks);
    } else if (chat.documents.length > 0) {
      await ragService.indexDocuments(chat._id.toString(), chat.documents);
    }
    const responseChat = chat.toObject();
    delete responseChat.vectorChunks;
    res.json(responseChat);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/chats/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    ragService.clearChat(req.params.id);
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chats/:id/upload - upload local file
router.post('/:id/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const text = await extractText(req.file.path, req.file.mimetype);
    if (!text || text.trim().length < 10) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Could not extract text from file' });
    }

    const doc = {
      name: req.file.originalname,
      type: 'local',
      content: text.substring(0, 500000), // cap at 500k chars
      source: req.file.originalname
    };

    chat.documents.push(doc);
    await chat.save();

    // Index in RAG
    await ragService.indexDocuments(chat._id.toString(), chat.documents);

    // Cleanup file
    fs.unlinkSync(req.file.path);

    res.json({ message: 'File uploaded and indexed', document: { name: doc.name, type: doc.type } });
  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// POST /api/chats/:id/attach-research - attach research paper by URL/content
router.post('/:id/attach-research', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const { title, abstract, url, content } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });

    let paperContent = content || abstract || '';
    if (url) {
      try {
        const pdfUrl = url
          .replace('/abs/', '/pdf/')
          .replace(/\.pdf\/?$/, '') + '.pdf';
        const response = await axios.get(pdfUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { Accept: 'application/pdf' }
        });
        const pdf = await pdfParse(response.data);
        if (pdf.text?.trim()) {
          paperContent = pdf.text;
        }
      } catch (pdfError) {
        console.warn('Could not fetch full research paper, using abstract:', pdfError.message);
      }
    }

    const doc = {
      name: title,
      type: 'research',
      content: paperContent.substring(0, 2000000),
      source: url || title
    };

    chat.documents.push(doc);
    await chat.save();
    await ragService.indexDocuments(chat._id.toString(), chat.documents);

    res.json({ message: 'Research paper attached', document: { name: doc.name, type: doc.type } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chats/:id/attach-docs - attach HuggingFace documentation
router.post('/:id/attach-docs', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const { title, content, url } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });

    const doc = {
      name: title,
      type: 'huggingface',
      content,
      source: url || title
    };

    chat.documents.push(doc);
    await chat.save();
    await ragService.indexDocuments(chat._id.toString(), chat.documents);

    res.json({ message: 'Documentation attached', document: { name: doc.name, type: doc.type } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/chats/:id/documents/:docIndex
router.delete('/:id/documents/:docIndex', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const idx = parseInt(req.params.docIndex);
    chat.documents.splice(idx, 1);
    await chat.save();
    await ragService.indexDocuments(chat._id.toString(), chat.documents);

    res.json({ message: 'Document removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chats/:id/message - send message
router.post('/:id/message', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Message required' });

    // Add user message
    chat.messages.push({ role: 'user', content: content.trim() });

    // Get RAG response
    const history = chat.messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const ragResult = await traceChat(
      { chatId: chat._id.toString(), userMessage: content.trim() },
      () => ragService.chat(
        chat._id.toString(),
        content.trim(),
        chat.documents,
        history.slice(0, -1),
        chat.vectorChunks
      )
    );

    // Add assistant message
    chat.messages.push({ role: 'assistant', content: ragResult.content });

    // Update title from first message
    if (chat.messages.length === 2) {
      chat.title = content.trim().substring(0, 60) + (content.length > 60 ? '...' : '');
    }

    await chat.save();

    res.json({
      message: { role: 'assistant', content: ragResult.content },
      sources: ragResult.usedChunks
    });
  } catch (err) {
    console.error(err);
    const providerMessage = err.response?.data?.error?.message;
    res.status(500).json({ message: providerMessage || err.message || 'Failed to get response' });
  }
});

// GET /api/chats/search/arxiv - search research papers
router.get('/search/arxiv', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query required' });

    const axios = require('axios');
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=10`;
    const response = await axios.get(url, { timeout: 30000 });

    // Parse XML response
    const text = response.data;
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(text)) !== null) {
      const entry = match[1];
      const getId = (tag) => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
      };

      const authors = [];
      const authorRegex = /<author>[^<]*<name>([^<]+)<\/name>/g;
      let am;
      while ((am = authorRegex.exec(entry)) !== null) authors.push(am[1]);

      entries.push({
        id: getId('id'),
        title: getId('title').replace(/\s+/g, ' '),
        abstract: getId('summary').replace(/\s+/g, ' ').substring(0, 500),
        authors: authors.slice(0, 3).join(', '),
        published: getId('published').substring(0, 10),
        url: getId('id')
      });
    }

    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Search failed. Check connectivity.' });
  }
});

// GET /api/chats/search/huggingface - search HF docs
router.get('/search/huggingface', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query required' });

    const axios = require('axios');
    // Use HuggingFace search API
    const response = await axios.get(
      `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=10`,
      { timeout: 10000 }
    );

    const results = response.data.map(model => ({
      id: model.id,
      title: model.id,
      description: model.description || `HuggingFace model: ${model.id}`,
      url: `https://huggingface.co/${model.id}`,
      downloads: model.downloads,
      tags: model.tags?.slice(0, 5) || []
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Search failed' });
  }
});

// GET /api/chats/fetch/huggingface-readme - fetch model README as doc content
router.get('/fetch/huggingface-readme', authMiddleware, async (req, res) => {
  try {
    const { modelId } = req.query;
    if (!modelId) return res.status(400).json({ message: 'Model ID required' });

    const axios = require('axios');
    const response = await axios.get(
      `https://huggingface.co/${modelId}/raw/main/README.md`,
      { timeout: 10000 }
    );

    res.json({ content: response.data.substring(0, 50000), title: modelId });
  } catch (err) {
    // Return a basic description if README not found
    res.json({
      content: `HuggingFace Model: ${req.query.modelId}\n\nThis model is available at https://huggingface.co/${req.query.modelId}`,
      title: req.query.modelId
    });
  }
});

module.exports = router;
