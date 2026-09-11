const { Langfuse } = require('langfuse');

const langfuseEnabled = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
);

const langfuse = langfuseEnabled
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
    })
  : null;

async function traceChat({ chatId, userMessage }, handler) {
  if (!langfuse) return handler();

  const trace = langfuse.trace({
    name: 'docuchat-chat',
    sessionId: chatId,
    input: { message: userMessage },
    environment: process.env.NODE_ENV || 'development',
    tags: ['docuchat', 'rag', 'groq'],
    metadata: {
      application: 'docuchat',
      operation: 'chat'
    }
  });
  const generation = trace.generation({
    name: 'groq-chat-completion',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    input: { message: userMessage },
    prompt: {
      name: 'docuchat-rag-prompt',
      version: 1
    },
    modelParameters: {
      max_tokens: 1000
    },
    metadata: {
      provider: 'groq',
      operation: 'chat-completion'
    }
  });

  try {
    const result = await handler();
    generation.end({
      output: result.content,
      usageDetails: result.usageDetails
    });
    trace.update({
      name: 'docuchat-chat',
      output: { message: result.content },
      environment: process.env.NODE_ENV || 'development',
      tags: ['docuchat', 'rag', 'groq']
    });
    return result;
  } catch (error) {
    generation.end({
      output: { error: error.message },
      level: 'ERROR',
      statusMessage: error.message
    });
    trace.update({
      name: 'docuchat-chat',
      output: { error: error.message },
      environment: process.env.NODE_ENV || 'development',
      tags: ['docuchat', 'rag', 'groq', 'error']
    });
    throw error;
  } finally {
    try {
      await langfuse.flushAsync();
    } catch (flushError) {
      console.warn('Langfuse flush failed:', flushError.message);
    }
  }
}

module.exports = { traceChat };