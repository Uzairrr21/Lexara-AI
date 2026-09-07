import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import DocumentPanel from '../components/DocumentPanel';
import api from '../utils/api';
import './Dashboard.css';

export default function Dashboard() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);

  const loadChats = useCallback(async () => {
    try {
      const { data } = await api.get('/chats');
      setChats(data);
    } catch {}
    setLoadingChats(false);
  }, []);

  useEffect(() => { loadChats(); }, [loadChats]);

  const handleNewChat = async () => {
    try {
      const { data } = await api.post('/chats');
      setChats(prev => [data, ...prev]);
      setActiveChatId(data._id);
      setDocuments([]);
    } catch {}
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setDocuments([]);
  };

  const handleDeleteChat = (id) => {
    setChats(prev => prev.filter(c => c._id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setDocuments([]);
    }
  };

  const handleDocumentsChange = useCallback((docs) => {
    if (docs) {
      setDocuments(docs);
    } else {
      // Refresh from server
      if (activeChatId) {
        api.get(`/chats/${activeChatId}`)
          .then(({ data }) => {
            setDocuments(data.documents || []);
            // Update chat list
            setChats(prev => prev.map(c =>
              c._id === activeChatId ? { ...c, documents: data.documents } : c
            ));
          })
          .catch(() => {});
      }
    }
  }, [activeChatId]);

  return (
    <div className="dashboard">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />
      <main className="dashboard-main">
        <ChatWindow
          chatId={activeChatId}
          documents={documents}
          onDocumentsChange={handleDocumentsChange}
          onNewChat={handleNewChat}
        />
      </main>
      {activeChatId && (
        <DocumentPanel
          chatId={activeChatId}
          documents={documents}
          onDocumentsChange={() => handleDocumentsChange(null)}
        />
      )}
    </div>
  );
}
