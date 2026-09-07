import { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import './Sidebar.css';

export default function Sidebar({ chats, activeChatId, onNewChat, onSelectChat, onDeleteChat }) {
  const { user, logout } = useAuth();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/chats/${id}`);
      onDeleteChat(id);
    } catch {}
    setDeletingId(null);
  };

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#10a37f"/>
            <circle cx="18" cy="18" r="8" fill="white" fillOpacity="0.3"/>
            <path d="M18 13v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>Lexara AI</span>
        </div>
      </div>

      {/* New Chat */}
      <button className="new-chat-btn" onClick={onNewChat}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        New Chat
      </button>

      {/* Chat list */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Recent Chats</div>
        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="chat-empty">No chats yet. Start one!</div>
          ) : chats.map(chat => (
            <div
              key={chat._id}
              className={`chat-item ${activeChatId === chat._id ? 'active' : ''}`}
              onClick={() => onSelectChat(chat._id)}
            >
              <div className="chat-item-icon">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="chat-item-title">{chat.title || 'New Chat'}</span>
              {chat.documents?.length > 0 && (
                <span className="chat-item-badge">{chat.documents.length}</span>
              )}
              <button
                className="chat-item-delete"
                onClick={e => handleDelete(e, chat._id)}
                disabled={deletingId === chat._id}
                title="Delete chat"
              >
                {deletingId === chat._id
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* User area */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div className="user-details">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
