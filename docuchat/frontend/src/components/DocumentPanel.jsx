import { useState, useRef } from 'react';
import api from '../utils/api';
import './DocumentPanel.css';

export default function DocumentPanel({ chatId, documents, onDocumentsChange }) {
  const [activeTab, setActiveTab] = useState('files'); // files | research | huggingface
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [attaching, setAttaching] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/chats/${chatId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onDocumentsChange();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); fileRef.current.value = ''; }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setResults([]); setError('');
    try {
      const endpoint = activeTab === 'research' ? '/chats/search/arxiv' : '/chats/search/huggingface';
      const { data } = await api.get(endpoint, { params: { q: query } });
      setResults(data);
    } catch (err) {
      setError('Search failed. Check your connection.');
    } finally { setSearching(false); }
  };

  const attachResearch = async (paper) => {
    setAttaching(paper.id); setError('');
    try {
      await api.post(`/chats/${chatId}/attach-research`, {
        title: paper.title,
        abstract: paper.abstract,
        url: paper.url,
        content: `Title: ${paper.title}\n\nAuthors: ${paper.authors}\n\nAbstract: ${paper.abstract}`
      });
      onDocumentsChange();
    } catch (err) {
      setError('Attach failed');
    } finally { setAttaching(null); }
  };

  const attachHFDoc = async (model) => {
    setAttaching(model.id); setError('');
    try {
      const { data } = await api.get('/chats/fetch/huggingface-readme', { params: { modelId: model.id } });
      await api.post(`/chats/${chatId}/attach-docs`, {
        title: model.title,
        content: data.content,
        url: model.url
      });
      onDocumentsChange();
    } catch (err) {
      setError('Attach failed');
    } finally { setAttaching(null); }
  };

  const removeDoc = async (idx) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      await api.delete(`/chats/${chatId}/documents/${idx}`);
      onDocumentsChange();
    } catch {}
  };

  return (
    <div className="doc-panel">
      <div className="doc-panel-header">
        <h3>Documents</h3>
        <div className="doc-panel-tabs">
          {[
            { id: 'files', label: '📁 Upload', title: 'Upload local file' },
            { id: 'research', label: '📄 Research', title: 'Search research papers' },
            { id: 'huggingface', label: '🤗 HuggingFace', title: 'Search HuggingFace docs' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`doc-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setResults([]); setQuery(''); setError(''); }}
              title={tab.title}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="doc-error">{error}</div>}

      {/* Attached documents */}
      {documents.length > 0 && (
        <div className="attached-docs">
          <div className="attached-label">Attached ({documents.length})</div>
          {documents.map((doc, i) => (
            <div key={i} className="attached-doc">
              <span className="doc-type-icon">
                {doc.type === 'local' ? '📁' : doc.type === 'research' ? '📄' : '🤗'}
              </span>
              <span className="doc-name" title={doc.name}>{doc.name}</span>
              <button className="doc-remove" onClick={() => removeDoc(i)} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="doc-panel-content">
        {activeTab === 'files' && (
          <div className="upload-area">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.docx,.doc"
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            <div
              className="upload-dropzone"
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  <span>Processing file...</span>
                </>
              ) : (
                <>
                  <svg width="36" height="36" fill="none" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                      stroke="#10a37f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <strong>Click to upload</strong>
                  <span>PDF, DOCX, TXT, MD — up to 20MB</span>
                </>
              )}
            </div>
          </div>
        )}

        {(activeTab === 'research' || activeTab === 'huggingface') && (
          <div className="search-area">
            <div className="search-bar">
              <input
                className="input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={activeTab === 'research' ? 'Search arXiv papers...' : 'Search HuggingFace models...'}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={searching}>
                {searching ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Search'}
              </button>
            </div>

            <div className="search-results">
              {results.length === 0 && !searching && (
                <div className="search-empty">
                  {activeTab === 'research'
                    ? 'Search academic papers on arXiv'
                    : 'Search HuggingFace models and docs'
                  }
                </div>
              )}
              {results.map(r => (
                <div key={r.id} className="search-result">
                  <div className="result-title">{r.title}</div>
                  <div className="result-meta">
                    {r.authors && <span>{r.authors}</span>}
                    {r.published && <span>{r.published}</span>}
                    {r.downloads != null && <span>{r.downloads?.toLocaleString()} downloads</span>}
                    {r.tags?.map(t => <span key={t} className="result-tag">{t}</span>)}
                  </div>
                  {r.abstract && <div className="result-abstract">{r.abstract}</div>}
                  {r.description && !r.abstract && <div className="result-abstract">{r.description}</div>}
                  <button
                    className="btn btn-ghost btn-sm result-attach"
                    onClick={() => activeTab === 'research' ? attachResearch(r) : attachHFDoc(r)}
                    disabled={attaching === r.id}
                  >
                    {attaching === r.id
                      ? <span className="spinner" style={{ width: 12, height: 12 }} />
                      : '+ Attach to Chat'
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
