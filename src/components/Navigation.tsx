import React from 'react';
import {
  CalendarDays,
  CheckSquare,
  Wallet,
  GraduationCap,
  Flame,
  FileText,
  Calendar,
  TrendingUp,
  Settings,
} from 'lucide-react';

export type ActiveTab =
  | 'today'
  | 'tasks'
  | 'calendar'
  | 'academics'
  | 'finances'
  | 'habits'
  | 'notes'
  | 'insights'
  | 'settings'
  | 'overview'
  | 'vtu'
  | 'exams';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  badgeCounts: {
    tasks: number;
    urgentExams: number;
  };
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  badgeCounts,
}) => {
  // Map legacy tabs to modern tabs if needed
  const normalizedActive =
    activeTab === 'overview'
      ? 'today'
      : activeTab === 'vtu' || activeTab === 'exams'
      ? 'academics'
      : activeTab;

  const tabs = [
    {
      id: 'tab-nav-today',
      key: 'today' as ActiveTab,
      label: 'Today',
      icon: CalendarDays,
    },
    {
      id: 'tab-nav-tasks',
      key: 'tasks' as ActiveTab,
      label: 'Tasks',
      icon: CheckSquare,
      badge: badgeCounts.tasks > 0 ? badgeCounts.tasks : undefined,
    },
    {
      id: 'tab-nav-calendar',
      key: 'calendar' as ActiveTab,
      label: 'Calendar',
      icon: Calendar,
    },
    {
      id: 'tab-nav-academics',
      key: 'academics' as ActiveTab,
      label: 'Academics',
      icon: GraduationCap,
      badge: badgeCounts.urgentExams > 0 ? `${badgeCounts.urgentExams} Soon` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'tab-nav-finances',
      key: 'finances' as ActiveTab,
      label: 'Finances',
      icon: Wallet,
    },
    {
      id: 'tab-nav-habits',
      key: 'habits' as ActiveTab,
      label: 'Habits',
      icon: Flame,
    },
    {
      id: 'tab-nav-notes',
      key: 'notes' as ActiveTab,
      label: 'Notes',
      icon: FileText,
    },
    {
      id: 'tab-nav-insights',
      key: 'insights' as ActiveTab,
      label: 'Insights',
      icon: TrendingUp,
    },
    {
      id: 'tab-nav-settings',
      key: 'settings' as ActiveTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <nav id="primary-app-nav" className="bg-white border-b border-slate-200 sticky top-16 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-1.5 overflow-x-auto py-2.5 scrollbar-none items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = normalizedActive === tab.key;

            return (
              <button
                key={tab.key}
                id={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.badgeColor || (isActive ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800')
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
