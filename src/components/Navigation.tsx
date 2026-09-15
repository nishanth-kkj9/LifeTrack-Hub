import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Wallet,
  GraduationCap,
  Flame,
  FileText,
  Award,
} from 'lucide-react';

export type ActiveTab = 'overview' | 'vtu' | 'tasks' | 'finances' | 'exams' | 'habits' | 'notes';

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
  const tabs = [
    {
      id: 'tab-nav-overview',
      key: 'overview' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'tab-nav-vtu',
      key: 'vtu' as ActiveTab,
      label: 'VTU Hub',
      icon: Award,
      badge: 'CBCS',
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'tab-nav-tasks',
      key: 'tasks' as ActiveTab,
      label: 'Todo List',
      icon: CheckSquare,
      badge: badgeCounts.tasks > 0 ? badgeCounts.tasks : undefined,
    },
    {
      id: 'tab-nav-finances',
      key: 'finances' as ActiveTab,
      label: 'Finances',
      icon: Wallet,
    },
    {
      id: 'tab-nav-exams',
      key: 'exams' as ActiveTab,
      label: 'Exams & Study',
      icon: GraduationCap,
      badge: badgeCounts.urgentExams > 0 ? `${badgeCounts.urgentExams} Soon` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'tab-nav-habits',
      key: 'habits' as ActiveTab,
      label: 'Habits & Streaks',
      icon: Flame,
    },
    {
      id: 'tab-nav-notes',
      key: 'notes' as ActiveTab,
      label: 'Scratchpad',
      icon: FileText,
    },
  ];

  return (
    <nav id="primary-app-nav" className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                id={tab.id}
                onClick={() => onSelectTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.badgeColor || 'bg-slate-200 text-slate-700'
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
