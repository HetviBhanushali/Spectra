import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Cpu,
  Server,
  Database,
  Search,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { SystemStatus, HealthStatus, EventItem, CorrelationItem } from '../api';

interface DashboardOverviewProps {
  status: SystemStatus | null;
  health: HealthStatus | null;
  recentEvents: EventItem[];
  recentCorrelations: CorrelationItem[];
  onSelectEvent: (event: EventItem) => void;
  onGoToEvents: () => void;
  onGoToCorrelations: () => void;
  onOpenSimulator: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  status,
  health,
  recentEvents,
  recentCorrelations,
  onSelectEvent,
  onGoToEvents,
  onGoToCorrelations,
  onOpenSimulator,
}) => {
  // Chart mock data trend combining current counts
  const chartData = [
    { time: '10:00', processed: Math.max(0, (status?.processed_events || 20) - 45), queued: 2 },
    { time: '10:15', processed: Math.max(0, (status?.processed_events || 20) - 30), queued: 5 },
    { time: '10:30', processed: Math.max(0, (status?.processed_events || 20) - 18), queued: 3 },
    { time: '10:45', processed: Math.max(0, (status?.processed_events || 20) - 8), queued: 1 },
    { time: '11:00', processed: status?.processed_events || 0, queued: status?.queued_events || 0 },
  ];

  const pieData = [
    { name: 'Processed', value: status?.processed_events || 1, color: '#10b981' },
    { name: 'Queued', value: status?.queued_events || 0, color: '#f59e0b' },
    { name: 'Failed', value: status?.failed_events || 0, color: '#f43f5e' },
    { name: 'DLQ', value: status?.dlq_count || 0, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Hero Overview Bar ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Event Stream & Processing Engine
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '4px' }}>
            Real-time telemetry from Redis Streams consumer groups, PostgreSQL metadata, and OpenSearch.
          </p>
        </div>

        {/* Infrastructure health status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <Server size={14} color="#06b6d4" />
            <span style={{ color: '#94a3b8' }}>Redis Streams:</span>
            <span style={{ fontWeight: 600, color: health?.services.redis?.status === 'healthy' ? '#34d399' : '#f87171' }}>
              {health?.services.redis?.status === 'healthy' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <Database size={14} color="#8b5cf6" />
            <span style={{ color: '#94a3b8' }}>PostgreSQL:</span>
            <span style={{ fontWeight: 600, color: health?.services.postgres?.status === 'healthy' ? '#34d399' : '#f87171' }}>
              {health?.services.postgres?.status === 'healthy' ? 'READY' : 'OFFLINE'}
            </span>
          </div>
          <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <Search size={14} color="#f59e0b" />
            <span style={{ color: '#94a3b8' }}>OpenSearch:</span>
            <span style={{ fontWeight: 600, color: health?.services.opensearch?.status === 'healthy' ? '#34d399' : '#94a3b8' }}>
              {health?.services.opensearch?.status === 'healthy' ? 'INDEXING' : 'READY'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Metric Cards Grid ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Card 1: Processed Events */}
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '3px', width: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Processed Events
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {(status?.processed_events ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} color="#10b981" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', fontSize: '0.75rem', color: '#34d399' }}>
            <TrendingUp size={14} />
            <span>Success rate: 99.8%</span>
          </div>
        </div>

        {/* Card 2: Queued & Backlog */}
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '3px', width: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Queue & Stream Depth
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {(status?.stream_length ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#f59e0b" />
            </div>
          </div>
          <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Pending in group: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{status?.pending_messages ?? 0}</span>
          </div>
        </div>

        {/* Card 3: Active Worker Coroutines */}
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '3px', width: '100%', background: 'linear-gradient(90deg, #06b6d4, #38bdf8)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Worker Pool
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {status?.active_workers ?? 3} <span style={{ fontSize: '1rem', color: '#64748b' }}>active</span>
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} color="#06b6d4" />
            </div>
          </div>
          <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Consumer Group: <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>spectra-workers</span>
          </div>
        </div>

        {/* Card 4: Dead-Letter Queue (DLQ) */}
        <div className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '3px', width: '100%', background: 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Dead-Letter Queue (DLQ)
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: status?.dlq_count ? '#fb7185' : '#ffffff', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                {(status?.dlq_count ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertOctagon size={20} color="#f43f5e" />
            </div>
          </div>
          <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Max Retries Before DLQ: <span style={{ color: '#fb7185', fontWeight: 600 }}>3 attempts</span>
          </div>
        </div>
      </div>

      {/* ─── Charts Section ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Throughput Area Chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff' }}>Processing Velocity</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ingestion and consumer commitment timeline</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#06b6d4' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} /> Processed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> In Queue
              </span>
            </div>
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0d121d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="processed" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorProc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff' }}>Status Distribution</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cumulative event disposition breakdown</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0d121d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              {pieData.map((p) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '2px', background: p.color }} />
                  <span style={{ color: '#94a3b8' }}>{p.name}:</span>
                  <span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recent Streams & Correlations Split ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Recent Events Table */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#06b6d4" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Recent Ingested Events</h3>
            </div>
            <button onClick={onGoToEvents} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              View All <ArrowUpRight size={13} />
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748b' }}>
              No events ingested yet. Run the Simulator below to generate sample workflows!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentEvents.slice(0, 5).map((evt) => (
                <div
                  key={evt.event_id}
                  onClick={() => onSelectEvent(evt)}
                  className="glass-panel-interactive"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${evt.processing_status}`}>
                      {evt.processing_status}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                        {evt.event_type}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                        {evt.event_id} &bull; {evt.source || 'api'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                    {evt.ingested_at ? new Date(evt.ingested_at).toLocaleTimeString() : 'now'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Correlation Clusters */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Active Correlations & Incidents</h3>
            </div>
            <button onClick={onGoToCorrelations} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              View All <ArrowUpRight size={13} />
            </button>
          </div>

          {recentCorrelations.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748b' }}>
              No correlation clusters active. Simulated multi-event workflows will correlate here automatically.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentCorrelations.slice(0, 5).map((corr) => (
                <div
                  key={corr.correlation_id}
                  className="glass-panel-interactive"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-purple">{corr.status}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                        {corr.correlation_key}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '3px' }}>
                      Confidence: {(corr.confidence_score * 100).toFixed(0)}% &bull; Correlated {corr.event_count} events
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {corr.correlation_id.substring(0, 10)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
