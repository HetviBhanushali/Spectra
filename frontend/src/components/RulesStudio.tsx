import React, { useState, useEffect } from 'react';
import { Shield, Plus, ToggleLeft, ToggleRight, RefreshCw, CheckCircle, Sliders } from 'lucide-react';
import { RuleItem, getRules, toggleRule, createRule } from '../api';

export const RulesStudio: React.FC = () => {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New rule form
  const [ruleId, setRuleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [threshold, setThreshold] = useState(5);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await getRules();
      setRules(data);
    } catch (err) {
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (rule: RuleItem) => {
    try {
      const updated = await toggleRule(rule.rule_id, !rule.is_active);
      setRules(rules.map((r) => (r.rule_id === rule.rule_id ? updated : r)));
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newRule = await createRule({
        rule_id: ruleId || `rule_${Date.now()}`,
        name,
        description,
        rule_type: 'sliding_window',
        severity,
        window_seconds: windowSeconds,
        threshold,
        action: 'alert',
        conditions: { threshold, window_seconds: windowSeconds },
        is_active: true,
      });
      setRules([...rules, newRule]);
      setShowCreateModal(false);
      setName('');
      setRuleId('');
      setDescription('');
    } catch (err) {
      console.error('Error creating rule:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>Rules Engine Studio</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>
            Real-time pattern evaluation, sliding windows, and anomaly thresholds executed by background workers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchRules} className="btn-secondary" style={{ padding: '8px 14px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ padding: '8px 16px' }}>
            <Plus size={16} /> New Rule
          </button>
        </div>
      </div>

      {/* Rules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {rules.map((rule) => {
          const sevColor =
            rule.severity === 'CRITICAL'
              ? '#f43f5e'
              : rule.severity === 'HIGH'
              ? '#f59e0b'
              : rule.severity === 'MEDIUM'
              ? '#8b5cf6'
              : '#06b6d4';

          return (
            <div
              key={rule.rule_id}
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${sevColor}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${sevColor}20`,
                      color: sevColor,
                      border: `1px solid ${sevColor}40`,
                    }}
                  >
                    {rule.severity}
                  </span>

                  <button
                    onClick={() => handleToggle(rule)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: rule.is_active ? '#10b981' : '#64748b',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {rule.is_active ? <ToggleRight size={26} color="#10b981" /> : <ToggleLeft size={26} color="#64748b" />}
                    <span style={{ fontWeight: 600 }}>{rule.is_active ? 'ACTIVE' : 'DISABLED'}</span>
                  </button>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff', marginTop: '12px' }}>
                  {rule.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', minHeight: '36px' }}>
                  {rule.description || 'No description provided.'}
                </p>
              </div>

              {/* Conditions & Metrics */}
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Sliding Window:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {rule.window_seconds} seconds
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Threshold:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    &gt;= {rule.threshold} events
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2', marginTop: '4px' }}>
                  <span style={{ color: '#64748b' }}>Action Trigger:</span>{' '}
                  <span style={{ color: '#38bdf8', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {rule.action || 'correlate_and_alert'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '500px', padding: '24px', background: '#0e1526' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
              Create Correlation Rule
            </h3>

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., High-Rate Auth Failure Alert"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Rule ID (optional slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g., auth_fail_burst"
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Severity
                </label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ width: '100%' }}>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Sliding Window (sec)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    value={windowSeconds}
                    onChange={(e) => setWindowSeconds(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Trigger Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Triggers an incident when count exceeds threshold in window."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
