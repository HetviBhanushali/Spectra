import React, { useState } from 'react';
import { X, Play, Send, Zap, ShieldAlert, ShoppingBag, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { ingestEvent } from '../api';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventsIngested: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  onEventsIngested,
}) => {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customType, setCustomType] = useState('user.signup');
  const [customEntity, setCustomEntity] = useState('user_492');
  const [customAction, setCustomAction] = useState('create');
  const [customCorrKey, setCustomCorrKey] = useState('sess_8829');

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 30)]);
  };

  const runScenario = async (name: string, eventsList: any[]) => {
    setRunningScenario(name);
    addLog(`Starting scenario: ${name}...`);

    for (let i = 0; i < eventsList.length; i++) {
      const evt = eventsList[i];
      try {
        const res = await ingestEvent({
          ...evt,
          event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          schema_version: '1.0',
        });
        addLog(`Published ${evt.event_type} (ID: ${res.event_id}) -> Queued`);
      } catch (err: any) {
        addLog(`Failed to publish ${evt.event_type}: ${err.message}`);
      }
      // Small delay between correlated events
      await new Promise((r) => setTimeout(r, 400));
    }

    addLog(`Scenario ${name} completed! Workers are processing events.`);
    setRunningScenario(null);
    onEventsIngested();
  };

  const handleNormalWorkflow = () => {
    const user = `user_${Math.floor(Math.random() * 900 + 100)}`;
    const session = `sess_${Math.random().toString(36).substring(2, 8)}`;
    runScenario('E-Commerce Order Flow', [
      { event_type: 'cart.item_added', source: 'web-store', entity_id: user, entity_type: 'user', action: 'add_to_cart', correlation_key: session, metadata: { item_id: 'prod_99', price: 49.99 } },
      { event_type: 'checkout.initiated', source: 'web-store', entity_id: user, entity_type: 'user', action: 'checkout', correlation_key: session, metadata: { total: 49.99 } },
      { event_type: 'payment.processed', source: 'payment-gateway', entity_id: user, entity_type: 'user', action: 'charge', correlation_key: session, status: 'success', metadata: { provider: 'stripe' } },
      { event_type: 'order.fulfilled', source: 'warehouse-service', entity_id: user, entity_type: 'order', action: 'fulfill', correlation_key: session, metadata: { tracking_id: 'trk_441' } },
    ]);
  };

  const handleFailedPayment = () => {
    const user = `user_${Math.floor(Math.random() * 900 + 100)}`;
    const session = `sess_${Math.random().toString(36).substring(2, 8)}`;
    runScenario('Payment Decline & Retry Flow', [
      { event_type: 'checkout.initiated', source: 'web-store', entity_id: user, entity_type: 'user', action: 'checkout', correlation_key: session },
      { event_type: 'payment.declined', source: 'payment-gateway', entity_id: user, entity_type: 'user', action: 'charge', correlation_key: session, status: 'failure', metadata: { code: 'insufficient_funds' } },
      { event_type: 'payment.retry_scheduled', source: 'billing-engine', entity_id: user, entity_type: 'user', action: 'retry', correlation_key: session, metadata: { backoff_sec: 30 } },
    ]);
  };

  const handleBruteForceAuth = () => {
    const victim = `user_target`;
    const ip = `192.168.1.105`;
    const burst = Array.from({ length: 6 }).map((_, i) => ({
      event_type: 'auth.login_failed',
      source: 'auth-service',
      entity_id: victim,
      entity_type: 'user',
      action: 'login',
      status: 'failure',
      correlation_key: victim,
      metadata: { attempt: i + 1, client_ip: ip, reason: 'bad_password' },
    }));
    runScenario('Brute-Force Anomaly Attack', burst);
  };

  const handleBurst = async (count: number) => {
    setRunningScenario(`Burst ${count}`);
    addLog(`Ingesting rapid burst of ${count} events...`);
    const types = ['api.request', 'database.query', 'cache.hit', 'notification.sent', 'metric.recorded'];

    const promises = Array.from({ length: count }).map(async (_, idx) => {
      const type = types[idx % types.length];
      const eid = `user_${Math.floor(Math.random() * 500)}`;
      return ingestEvent({
        event_id: `evt_burst_${Date.now()}_${idx}`,
        event_type: type,
        source: 'load-generator',
        entity_id: eid,
        correlation_key: eid,
        action: 'execute',
        status: 'success',
      });
    });

    try {
      await Promise.all(promises);
      addLog(`Successfully published ${count} concurrent events to Redis stream!`);
    } catch (e: any) {
      addLog(`Error during burst: ${e.message}`);
    } finally {
      setRunningScenario(null);
      onEventsIngested();
    }
  };

  const handleSendCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await ingestEvent({
        event_id: `evt_custom_${Date.now()}`,
        event_type: customType,
        entity_id: customEntity,
        action: customAction,
        correlation_key: customCorrKey,
        source: 'ui-sandbox',
        status: 'success',
      });
      addLog(`Custom event emitted: ${res.event_id} (${customType})`);
      onEventsIngested();
    } catch (err: any) {
      addLog(`Failed to emit custom event: ${err.message}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 12, 0.85)',
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
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1322',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={22} color="#06b6d4" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                Event Simulator & Load Generator
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Trigger realistic workflows, stress-test consumer groups, and observe live correlation.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Quick Scenario Buttons */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
              Pre-Packaged Distributed Scenarios
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {/* Scenario 1 */}
              <div
                className="glass-panel-interactive"
                style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                onClick={handleNormalWorkflow}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} color="#10b981" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>E-Commerce Flow</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                  Cart &rarr; Checkout &rarr; Payment &rarr; Fulfillment sequence.
                </p>
                <button
                  disabled={!!runningScenario}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '0.75rem' }}
                >
                  <Play size={12} /> Run Scenario
                </button>
              </div>

              {/* Scenario 2 */}
              <div
                className="glass-panel-interactive"
                style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                onClick={handleFailedPayment}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={18} color="#f59e0b" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Payment Decline</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                  Failed payment triggers backoff retry and status degradation.
                </p>
                <button
                  disabled={!!runningScenario}
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '0.75rem' }}
                >
                  <Play size={12} /> Run Scenario
                </button>
              </div>

              {/* Scenario 3 */}
              <div
                className="glass-panel-interactive"
                style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                onClick={handleBruteForceAuth}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#f43f5e" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Brute-Force Attack</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                  6 rapid login failures to trigger the Correlation Rules Engine.
                </p>
                <button
                  disabled={!!runningScenario}
                  className="btn-danger"
                  style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '0.75rem' }}
                >
                  <Play size={12} /> Trigger Anomaly
                </button>
              </div>
            </div>
          </div>

          {/* Load Burst Buttons */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Concurrency & Burst Testing</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Push high-volume batches directly to Redis Streams consumer group.</div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button disabled={!!runningScenario} onClick={() => handleBurst(10)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                +10 Events
              </button>
              <button disabled={!!runningScenario} onClick={() => handleBurst(25)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                +25 Events
              </button>
            </div>
          </div>

          {/* Custom Event Builder */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
              Custom Event Builder
            </h4>
            <form onSubmit={handleSendCustom} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <input
                type="text"
                placeholder="event_type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
              <input
                type="text"
                placeholder="entity_id"
                value={customEntity}
                onChange={(e) => setCustomEntity(e.target.value)}
              />
              <input
                type="text"
                placeholder="action"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
              />
              <input
                type="text"
                placeholder="correlation_key"
                value={customCorrKey}
                onChange={(e) => setCustomCorrKey(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px' }}>
                <Send size={14} /> Send Event
              </button>
            </form>
          </div>

          {/* Simulator Live Execution Console */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Terminal size={14} color="#06b6d4" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Simulation Terminal Log
              </span>
            </div>
            <div
              style={{
                background: '#07090e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px',
                height: '140px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: '#38bdf8',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#64748b' }}>Ready. Click any scenario button above to start generating events.</div>
              ) : (
                logs.map((log, i) => <div key={i}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
