import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../utils/api';
import './ChatWindow.css';

export default function ChatWindow({ chatId, documents, onDocumentsChange, onNewChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef();
  const textareaRef = useRef();

  const loadChat = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/chats/${chatId}`);
      setMessages(data.messages || []);
      onDocumentsChange(data.documents || []);
    } catch {}
    setLoading(false);
  }, [chatId, onDocumentsChange]);

  useEffect(() => { loadChat(); }, [loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setError('');

    // Optimistically add user message
    const userMsg = { role: 'user', content, _id: Date.now() + '' };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data } = await api.post(`/chats/${chatId}/message`, { content });
      setMessages(prev => [...prev, data.message]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get response');
      setMessages(prev => prev.filter(m => m._id !== userMsg._id));
    } finally { setSending(false); }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const autoResize = e => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const hasDocuments = documents && documents.length > 0;

  if (!chatId) {
    return (
      <div className="chat-empty-state">
        <button className="empty-icon" type="button" onClick={onNewChat} aria-label="Create a new chat">
          <svg width="56" height="56" fill="none" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="26" stroke="#10a37f" strokeWidth="1.5" strokeDasharray="5 3"/>
            <path d="M20 28h16M28 20v16" stroke="#10a37f" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <h2>Welcome to Lexara AI</h2>
        <p>Create a new chat, upload documents, then ask anything about them.</p>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Messages */}
      <div className="messages-area">
        {loading && (
          <div className="messages-loading">
            <span className="spinner" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="chat-start-hint">
            <div className="hint-icon">
              {hasDocuments
                ? <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M9 12h6M9 16h6M6 2h8l4 4v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="#10a37f" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                : <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#10a37f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </div>
            {hasDocuments
              ? <><h3>{documents.length} document{documents.length > 1 ? 's' : ''} attached</h3>
                  <p>Ask any question about your documents and I'll answer from the content.</p></>
              : <><h3>No documents yet</h3>
                  <p>Use the panel on the right to upload a file, search research papers, or find HuggingFace docs.</p></>
            }
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg._id || i} className={`message-row ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user'
                ? <div className="avatar-user">U</div>
                : <div className="avatar-ai">
                    <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
                      <rect width="36" height="36" rx="8" fill="#10a37f"/>
                      <circle cx="18" cy="18" r="8" fill="white" fillOpacity="0.3"/>
                      <path d="M18 13v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
              }
            </div>
            <div className="message-bubble">
              {msg.role === 'assistant'
                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                : <p>{msg.content}</p>
              }
            </div>
          </div>
        ))}

        {sending && (
          <div className="message-row assistant">
            <div className="message-avatar">
              <div className="avatar-ai">
                <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
                  <rect width="36" height="36" rx="8" fill="#10a37f"/>
                  <circle cx="18" cy="18" r="8" fill="white" fillOpacity="0.3"/>
                  <path d="M18 13v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div className="message-bubble typing">
              <span/><span/><span/>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        {!hasDocuments && (
          <div className="no-docs-warning">
            ⚠️ Attach a document first to start chatting
          </div>
        )}
        <div className="input-box">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e); }}
            onKeyDown={handleKey}
            placeholder={hasDocuments ? "Ask anything about your documents..." : "Upload a document to begin..."}
            rows={1}
            disabled={!hasDocuments || sending}
          />
          <button
            className="send-btn"
            onClick={send}
            disabled={!input.trim() || sending || !hasDocuments}
          >
            {sending
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </button>
        </div>
        <p className="input-hint">Lexara AI only answers from attached documents.</p>
      </div>
    </div>
  );
}
