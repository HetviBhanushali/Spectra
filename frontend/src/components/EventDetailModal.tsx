import React, { useState } from 'react';
import { X, Copy, Check, CheckCircle2, Clock, Cpu, Database, Search } from 'lucide-react';
import { EventItem } from '../api';

interface EventDetailModalProps {
  event: EventItem | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 12, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1322',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`badge badge-${event.processing_status}`}>{event.processing_status}</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {event.event_id}
              </h3>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Event Type: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{event.event_type}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleCopy} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied JSON' : 'Copy JSON'}
            </button>
            <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Processing Lifecycle Pipeline */}
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
              Processing Pipeline Lifecycle
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <Clock size={16} color="#06b6d4" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>1. Ingestion</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>Accepted</div>
              </div>
              <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <Cpu size={16} color="#8b5cf6" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>2. Worker</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>Rules Evaluated</div>
              </div>
              <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>3. Correlation</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: event.correlation_id ? '#34d399' : '#94a3b8' }}>
                  {event.correlation_id ? 'Correlated' : 'Standalone'}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <Database size={16} color="#f59e0b" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>4. OpenSearch</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>Indexed</div>
              </div>
            </div>
          </div>

          {/* Properties Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Entity ID & Type</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {event.entity_id || '—'} {event.entity_type ? `(${event.entity_type})` : ''}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Correlation Key</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a78bfa', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {event.correlation_key || '—'}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Source & Producer</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                {event.source || '—'} {event.producer ? `&bull; ${event.producer}` : ''}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Correlation Cluster ID</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {event.correlation_id || 'None (Uncorrelated)'}
              </div>
            </div>
          </div>

          {/* Raw JSON Payload */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Event Payload JSON
              </h4>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Schema v{event.schema_version}</span>
            </div>
            <pre className="code-block" style={{ maxHeight: '250px' }}>
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
