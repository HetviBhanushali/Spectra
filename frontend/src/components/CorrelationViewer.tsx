import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, Clock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { CorrelationItem, getCorrelations } from '../api';

export const CorrelationViewer: React.FC = () => {
  const [correlations, setCorrelations] = useState<CorrelationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCorrelation, setSelectedCorrelation] = useState<CorrelationItem | null>(null);

  const fetchCorrelations = async () => {
    setLoading(true);
    try {
      const data = await getCorrelations({ page: 1, page_size: 50 });
      setCorrelations(data.items);
      if (data.items.length > 0 && !selectedCorrelation) {
        setSelectedCorrelation(data.items[0]);
      }
    } catch (err) {
      console.error('Error fetching correlations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelations();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>Correlation Engine</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>
            Groups events across time windows, entity IDs, and sliding patterns to identify incidents and workflows.
          </p>
        </div>

        <button onClick={fetchCorrelations} className="btn-secondary" style={{ padding: '8px 14px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main Grid: List on Left, Detail on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Correlation Clusters List */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
            Active Correlation Clusters ({correlations.length})
          </h3>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading correlations...</div>
          ) : correlations.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
              No correlation clusters active yet.
              <br />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', display: 'inline-block' }}>
                Use the Simulator to trigger related events with matching correlation keys!
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {correlations.map((corr) => {
                const isSelected = selectedCorrelation?.correlation_id === corr.correlation_id;
                return (
                  <div
                    key={corr.correlation_id}
                    onClick={() => setSelectedCorrelation(corr)}
                    className="glass-panel-interactive"
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.06)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-purple">{corr.status}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {corr.event_count} events linked
                      </span>
                    </div>

                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginTop: '8px' }}>
                      Key: <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{corr.correlation_key}</span>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(corr.confidence_score || 0.85) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.725rem', color: '#a78bfa', fontWeight: 600 }}>
                        {((corr.confidence_score || 0.85) * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Correlation Deep Dive */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          {selectedCorrelation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-purple">{selectedCorrelation.status}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                      Cluster Details
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    ID: {selectedCorrelation.correlation_id}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {selectedCorrelation.event_count}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Events</div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Correlation Key</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {selectedCorrelation.correlation_key}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Entity ID</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {selectedCorrelation.entity_id || 'Global / Shared'}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>First Event</div>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginTop: '2px' }}>
                    {selectedCorrelation.first_event_at ? new Date(selectedCorrelation.first_event_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Last Event</div>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginTop: '2px' }}>
                    {selectedCorrelation.last_event_at ? new Date(selectedCorrelation.last_event_at).toLocaleTimeString() : '—'}
                  </div>
                </div>
              </div>

              {/* Correlation Graph / Timeline representation */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>
                  Correlation Sequence Timeline
                </h4>
                <div style={{ position: 'relative', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(6, 182, 212, 0.3)' }} />

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>Origin Event Identified</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Initial trigger matching entity identifier and window.</div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>Follow-up Event Correlated</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Second matched action within sliding threshold window.</div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>Incident Formed</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Correlation engine confirmed pattern with {((selectedCorrelation.confidence_score || 0.85) * 100).toFixed(0)}% confidence.</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '64px', textAlign: 'center', color: '#64748b' }}>
              Select a correlation cluster on the left to inspect its timeline and incident properties.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
