import React from 'react';

export interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
}

function DashboardCard({ title, value, subtitle, accent = '#7c3aed' }: DashboardCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 18,
        minHeight: 120,
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7 }}>{title}</div>
      <div
        style={{
          marginTop: 12,
          fontSize: 28,
          fontWeight: 700,
          color: accent,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

export interface LifeDashboardProps {
  totalHabits?: number;
  completionRate?: number;
  averageMood?: number;
  averageEnergy?: number;
  averageSleep?: number;
  insights?: string[];
  className?: string;
}

export function LifeDashboard({
  totalHabits = 0,
  completionRate = 0,
  averageMood = 0,
  averageEnergy = 0,
  averageSleep = 0,
  insights = [],
  className = '',
}: LifeDashboardProps) {
  return (
    <div className={className} style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <DashboardCard title="Habits" value={String(totalHabits)} subtitle="Active routines" accent="#8b5cf6" />
        <DashboardCard title="Completion" value={`${completionRate.toFixed(0)}%`} subtitle="Weekly average" accent="#22c55e" />
        <DashboardCard title="Mood" value={`${averageMood.toFixed(1)}/5`} subtitle="Tracked sentiment" accent="#f59e0b" />
        <DashboardCard title="Energy" value={`${averageEnergy.toFixed(1)}/5`} subtitle="Current rhythm" accent="#06b6d4" />
        <DashboardCard title="Sleep" value={`${averageSleep.toFixed(1)}h`} subtitle="Average nightly sleep" accent="#ef4444" />
      </div>

      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 18,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Life Insights</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
          {insights.length ? (
            insights.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
          ) : (
            <li>Add your first metrics to see personalized insights.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default LifeDashboard;
