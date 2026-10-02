import React from 'react';
import { Activity, Shield, Zap, Layers, AlertTriangle, PlayCircle, Database } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeWorkers: number;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  onOpenSimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeWorkers,
  isLive,
  setIsLive,
  onOpenSimulator,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'events', label: 'Event Stream', icon: Zap },
    { id: 'correlations', label: 'Correlations', icon: Layers },
    { id: 'rules', label: 'Rules Engine', icon: Shield },
    { id: 'dlq', label: 'DLQ & Failures', icon: AlertTriangle },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'rgba(10, 13, 20, 0.85)' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => setCurrentTab('dashboard')}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
          }}>
            <Zap size={20} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SPECTRA
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
              Event Processing & Correlation
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2))' : 'transparent',
                  color: active ? '#ffffff' : '#94a3b8',
                  borderColor: active ? 'rgba(6, 182, 212, 0.4)' : 'transparent',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  fontSize: '0.85rem',
                  fontWeight: active ? 600 : 400,
                  boxShadow: active ? '0 2px 10px rgba(6, 182, 212, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} color={active ? '#38bdf8' : '#64748b'} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Status Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live stream switch */}
          <div
            onClick={() => setIsLive(!isLive)}
            title={isLive ? 'Polling stream updates active' : 'Stream paused'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: isLive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isLive ? '#34d399' : '#94a3b8',
            }}
          >
            <span className={isLive ? 'live-dot' : ''} style={!isLive ? { width: 8, height: 8, borderRadius: '50%', background: '#64748b' } : {}} />
            {isLive ? 'STREAM LIVE' : 'PAUSED'}
          </div>

          {/* Quick simulator trigger button */}
          <button
            onClick={onOpenSimulator}
            className="btn-primary"
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
          >
            <PlayCircle size={16} />
            Simulator Sandbox
          </button>
        </div>
      </div>
    </header>
  );
};
