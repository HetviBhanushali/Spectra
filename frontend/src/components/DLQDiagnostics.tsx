import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw, AlertTriangle, CheckCircle, Bug } from 'lucide-react';
import { DLQItem, getDLQ, getFailures } from '../api';

export const DLQDiagnostics: React.FC = () => {
  const [dlqItems, setDlqItems] = useState<DLQItem[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDLQ, setSelectedDLQ] = useState<DLQItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dlqData, failData] = await Promise.all([getDLQ(50), getFailures(50)]);
      setDlqItems(dlqData);
      setFailures(failData);
    } catch (err) {
      console.error('Error fetching DLQ & failures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
            Dead-Letter Queue (DLQ) & Fault Diagnostics
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>
            Inspect poisoned pills, exceeded retry budgets (MAX_RETRIES=3), and unhandled worker exceptions.
          </p>
        </div>

        <button onClick={fetchData} className="btn-secondary" style={{ padding: '8px 14px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Grid: DLQ stream on left, Recent Failures on right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* DLQ Stream Messages */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={18} color="#f43f5e" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                DLQ Stream Entries ({dlqItems.length})
              </h3>
            </div>
          </div>

          {dlqItems.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <div>DLQ stream is completely clear!</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                Events that exceed 3 consecutive retries or fail validation will appear here.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dlqItems.map((item) => (
                <div
                  key={item.message_id}
                  onClick={() => setSelectedDLQ(item)}
                  className="glass-panel-interactive"
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.05)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-dlq">DLQ EXHAUSTED</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {item.last_failed_at ? new Date(item.last_failed_at).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                    {item.event_id || item.message_id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fb7185', marginTop: '4px' }}>
                    Reason: {item.failure_reason || 'Unknown error'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Worker Attempt Failures */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bug size={18} color="#f59e0b" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                Recent Retry Attempts ({failures.length})
              </h3>
            </div>
          </div>

          {failures.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <div>No worker failures recorded.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {failures.slice(0, 10).map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {f.event_id}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                      Attempt #{f.attempt_number}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {f.failure_reason || 'Worker execution error'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                    Worker: {f.worker_id} &bull; {f.attempted_at ? new Date(f.attempted_at).toLocaleTimeString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected DLQ Inspection Modal */}
      {selectedDLQ && (
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
          onClick={() => setSelectedDLQ(null)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '650px', padding: '24px', background: '#0e1526' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              DLQ Dead Letter Payload
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
              Message ID: <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{selectedDLQ.message_id}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#fb7185', fontWeight: 600 }}>
                Failure Reason: {selectedDLQ.failure_reason}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Retry Count Exceeded: {selectedDLQ.retry_count} / 3
              </div>

              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginTop: '8px' }}>
                Original Payload
              </h4>
              <pre className="code-block" style={{ maxHeight: '200px' }}>
                {JSON.stringify(selectedDLQ.original_data, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setSelectedDLQ(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
