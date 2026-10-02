import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { EventExplorer } from './components/EventExplorer';
import { CorrelationViewer } from './components/CorrelationViewer';
import { RulesStudio } from './components/RulesStudio';
import { DLQDiagnostics } from './components/DLQDiagnostics';
import { EventDetailModal } from './components/EventDetailModal';
import { SimulatorModal } from './components/SimulatorModal';
import {
  SystemStatus,
  HealthStatus,
  EventItem,
  CorrelationItem,
  getProcessingStatus,
  getHealth,
  getEvents,
  getCorrelations,
  login,
} from './api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isLive, setIsLive] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Core telemetry state
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [recentCorrelations, setRecentCorrelations] = useState<CorrelationItem[]>([]);

  // Authenticate initially with default admin if token absent
  useEffect(() => {
    const initAuth = async () => {
      if (!localStorage.getItem('spectra_token')) {
        try {
          await login('admin', 'admin123');
        } catch (e) {
          console.warn('Initial admin login auto-attempt skipped:', e);
        }
      }
    };
    initAuth();
  }, []);

  const refreshTelemetry = useCallback(async () => {
    try {
      const [statusRes, healthRes, eventsRes, corrRes] = await Promise.allSettled([
        getProcessingStatus(),
        getHealth(),
        getEvents({ page: 1, page_size: 10 }),
        getCorrelations({ page: 1, page_size: 10 }),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (eventsRes.status === 'fulfilled') setRecentEvents(eventsRes.value.items);
      if (corrRes.status === 'fulfilled') setRecentCorrelations(corrRes.value.items);
    } catch (err) {
      console.error('Telemetry refresh error:', err);
    }
  }, []);

  // Live polling
  useEffect(() => {
    refreshTelemetry();
    if (!isLive) return;

    const interval = setInterval(() => {
      refreshTelemetry();
    }, 3500);

    return () => clearInterval(interval);
  }, [isLive, refreshTelemetry]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeWorkers={status?.active_workers ?? 3}
        isLive={isLive}
        setIsLive={setIsLive}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '28px 24px 60px' }}>
        {currentTab === 'dashboard' && (
          <DashboardOverview
            status={status}
            health={health}
            recentEvents={recentEvents}
            recentCorrelations={recentCorrelations}
            onSelectEvent={setSelectedEvent}
            onGoToEvents={() => setCurrentTab('events')}
            onGoToCorrelations={() => setCurrentTab('correlations')}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
          />
        )}

        {currentTab === 'events' && (
          <EventExplorer onSelectEvent={setSelectedEvent} />
        )}

        {currentTab === 'correlations' && (
          <CorrelationViewer />
        )}

        {currentTab === 'rules' && (
          <RulesStudio />
        )}

        {currentTab === 'dlq' && (
          <DLQDiagnostics />
        )}
      </main>

      {/* Global Modals */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onEventsIngested={() => refreshTelemetry()}
      />
    </div>
  );
};
export default App;
