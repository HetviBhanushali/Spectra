import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Eye, ArrowLeft, ArrowRight, Zap, Database } from 'lucide-react';
import { EventItem, getEvents, searchEvents } from '../api';

interface EventExplorerProps {
  onSelectEvent: (event: EventItem) => void;
}

export const EventExplorer: React.FC<EventExplorerProps> = ({ onSelectEvent }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      if (searchQuery.trim().length > 0) {
        // OpenSearch full-text search
        const results = await searchEvents(searchQuery.trim(), 50);
        setEvents(results);
        setTotal(results.length);
        setTotalPages(1);
      } else {
        const data = await getEvents({
          page,
          page_size: pageSize,
          processing_status: selectedStatus || undefined,
          event_type: selectedType || undefined,
        });
        setEvents(data.items);
        setTotal(data.total);
        setTotalPages(data.pages);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, selectedStatus, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>Event Stream Explorer</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>
            Query and filter raw and processed events indexed via PostgreSQL and OpenSearch.
          </p>
        </div>

        <button onClick={fetchEvents} className="btn-secondary" style={{ padding: '8px 14px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search across all event fields with OpenSearch (e.g., checkout.completed, user_84, failure)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
            Search OpenSearch
          </button>
          {searchQuery && (
            <button type="button" onClick={handleClearSearch} className="btn-secondary">
              Clear
            </button>
          )}
        </form>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
            <Filter size={14} /> Filter Status:
          </div>
          {['', 'queued', 'processing', 'processed', 'failed', 'dlq'].map((status) => (
            <button
              key={status || 'all'}
              onClick={() => {
                setSelectedStatus(status);
                setPage(1);
              }}
              style={{
                background: selectedStatus === status ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: selectedStatus === status ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: selectedStatus === status ? '#38bdf8' : '#94a3b8',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: selectedStatus === status ? 600 : 400,
              }}
            >
              {status ? status.toUpperCase() : 'ALL STATUSES'}
            </button>
          ))}
        </div>
      </div>

      {/* Events Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Event ID</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Source / Producer</th>
                <th style={{ padding: '12px 16px' }}>Entity ID</th>
                <th style={{ padding: '12px 16px' }}>Correlation Key</th>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    No events found matching your criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr
                    key={evt.event_id}
                    onClick={() => onSelectEvent(evt)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge badge-${evt.processing_status}`}>
                        {evt.processing_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#38bdf8' }}>
                      {evt.event_id}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ffffff' }}>
                      {evt.event_type}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {evt.source || '—'} {evt.producer ? `(${evt.producer})` : ''}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#e2e8f0' }}>
                      {evt.entity_id || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#a78bfa' }}>
                      {evt.correlation_key || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.775rem' }}>
                      {evt.ingested_at ? new Date(evt.ingested_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(evt);
                        }}
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        <Eye size={13} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!searchQuery && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Showing {events.length} of {total} events (Page {page} of {totalPages})
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
