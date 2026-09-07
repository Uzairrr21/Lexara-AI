const axios = require('axios');
const { pipeline } = require('@xenova/transformers');
const Chat = require('../models/Chat');

const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const embeddingModel = 'Xenova/all-MiniLM-L6-v2';
const maxContextCharacters = 12000;
const maxHistoryCharacters = 4000;
let embedderPromise;

function getEmbedder() {
  if (!embedderPromise) embedderPromise = pipeline('feature-extraction', embeddingModel);
  return embedderPromise;
}

async function embedText(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function generateWithGroq(systemPrompt, messages) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Add a Groq API key to backend/.env.');
  }

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: groqModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 1000
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const text = response.data?.choices?.[0]?.message?.content?.trim();

  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

// Vectors are normalized by the embedding model, but keep this safe for old data.
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Split text into moderately sized semantic units.
function chunkText(text, chunkSize = 500, overlap = 75) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    if (i + chunkSize >= words.length) break;
  }
  return chunks.filter(c => c.trim().length > 0);
}

class RAGService {
  constructor() {
    this.documentStore = new Map(); // chatId -> [{chunk, embedding, source}]
  }

  async indexDocuments(chatId, documents) {
    const allChunks = [];
    for (const doc of documents) {
      if (!doc.content) continue;
      const chunks = chunkText(doc.content);
      for (const chunk of chunks) {
        allChunks.push({
          chunk,
          embedding: await embedText(chunk),
          source: doc.name || doc.source || 'Document',
          docType: doc.type
        });
      }
    }
    this.documentStore.set(chatId, allChunks);
    await Chat.findByIdAndUpdate(chatId, {
      $set: {
        vectorChunks: allChunks.map(item => ({
          text: item.chunk,
          embedding: item.embedding,
          source: item.source,
          docType: item.docType
        }))
      }
    });
    return allChunks.length;
  }

  restoreIndex(chatId, vectorChunks) {
    this.documentStore.set(chatId, (vectorChunks || []).map(item => ({
      chunk: item.text,
      embedding: item.embedding,
      source: item.source || 'Document',
      docType: item.docType
    })));
  }

  retrieveRelevantChunks(chatId, query, topK = 5) {
    const chunks = this.documentStore.get(chatId) || [];
    if (!chunks.length) return [];

    const queryEmb = query;
    const scored = chunks.map(c => ({
      ...c,
      score: cosineSimilarity(queryEmb, c.embedding)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(c => c.score > 0.01);
  }

  async chat(chatId, userMessage, documents, conversationHistory = [], persistedChunks = []) {
    if (!this.documentStore.has(chatId)) {
      if (persistedChunks.length > 0) {
        this.restoreIndex(chatId, persistedChunks);
      } else if (documents && documents.length > 0) {
        await this.indexDocuments(chatId, documents);
      }
    }

    const queryEmbedding = await embedText(userMessage);
    const relevantChunks = this.retrieveRelevantChunks(chatId, queryEmbedding);

    if (!relevantChunks.length && (!documents || documents.length === 0)) {
      return {
        content: "⚠️ No documents are attached to this chat. Please upload a file, attach a research paper, or link documentation before asking questions.",
        usedChunks: []
      };
    }

    if (!relevantChunks.length) {
      return {
        content: "I couldn't find relevant information in the attached documents to answer your question. Please try rephrasing or ask something directly related to the document content.",
        usedChunks: []
      };
    }

    const contextParts = [];
    let contextLength = 0;
    for (const [index, chunk] of relevantChunks.entries()) {
      const part = `[Source ${index + 1}: ${chunk.source}]\n${chunk.chunk}`;
      const separatorLength = contextParts.length ? 9 : 0;
      if (contextLength + separatorLength + part.length > maxContextCharacters) {
        const remaining = maxContextCharacters - contextLength - separatorLength;
        if (remaining > 200) {
          contextParts.push(part.substring(0, remaining));
        }
        break;
      }
      contextParts.push(part);
      contextLength += separatorLength + part.length;
    }
    const context = contextParts.join('\n\n---\n\n');

    const systemPrompt = `You are DocuChat, a precise document analysis assistant. You ONLY answer questions based on the provided document excerpts below.

STRICT RULES:
1. Only use information from the provided context to answer.
2. If the answer is not in the context, say: "This information is not available in the attached documents."
3. Do NOT answer general knowledge questions, current events, or anything unrelated to the documents.
4. Cite which source/document your answer comes from.
5. Be concise but thorough.

DOCUMENT CONTEXT:
${context}`;

    let historyLength = 0;
    const recentHistory = conversationHistory.slice().reverse().reduce((items, message) => {
      if (historyLength >= maxHistoryCharacters) return items;
      const content = String(message.content || '');
      const remaining = maxHistoryCharacters - historyLength;
      const trimmedContent = content.substring(0, remaining);
      historyLength += trimmedContent.length;
      items.unshift({ role: message.role, content: trimmedContent });
      return items;
    }, []);
    const messages = [
      ...recentHistory,
      { role: 'user', content: userMessage }
    ];

    return {
      content: await generateWithGroq(systemPrompt, messages),
      usedChunks: relevantChunks.map(c => ({ source: c.source, score: c.score }))
    };
  }

  clearChat(chatId) {
    this.documentStore.delete(chatId);
  }
}

module.exports = new RAGService();
