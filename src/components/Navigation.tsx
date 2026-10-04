import React, { useState, useRef, useEffect } from 'react';
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
  MoreHorizontal,
  X,
  ChevronRight,
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
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Normalize legacy tabs
  const normalizedActive =
    activeTab === 'overview'
      ? 'today'
      : activeTab === 'vtu' || activeTab === 'exams'
      ? 'academics'
      : activeTab;

  // Primary desktop tabs
  const desktopPrimaryTabs = [
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
  ];

  // Secondary desktop tabs
  const desktopSecondaryTabs = [
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

  // Mobile primary items (First 4 + More)
  const mobilePrimaryTabs = [
    {
      id: 'mobile-nav-today',
      key: 'today' as ActiveTab,
      label: 'Today',
      icon: CalendarDays,
    },
    {
      id: 'mobile-nav-tasks',
      key: 'tasks' as ActiveTab,
      label: 'Tasks',
      icon: CheckSquare,
      badge: badgeCounts.tasks > 0 ? badgeCounts.tasks : undefined,
    },
    {
      id: 'mobile-nav-calendar',
      key: 'calendar' as ActiveTab,
      label: 'Calendar',
      icon: Calendar,
    },
    {
      id: 'mobile-nav-academics',
      key: 'academics' as ActiveTab,
      label: 'Academics',
      icon: GraduationCap,
      badge: badgeCounts.urgentExams > 0 ? `${badgeCounts.urgentExams} Soon` : undefined,
    },
  ];

  // Items inside mobile "More" menu
  const mobileMoreTabs = [
    {
      key: 'finances' as ActiveTab,
      label: 'Finances & Budget',
      description: 'Income, expense logs and monthly budget cap',
      icon: Wallet,
    },
    {
      key: 'habits' as ActiveTab,
      label: 'Habits & Streaks',
      description: 'Daily consistency tracking and streak counters',
      icon: Flame,
    },
    {
      key: 'notes' as ActiveTab,
      label: 'Notes & Scratchpad',
      description: 'Quick notes, pinned thoughts, and ideas',
      icon: FileText,
    },
    {
      key: 'insights' as ActiveTab,
      label: 'Insights & Review',
      description: 'Weekly reflection, completion rate, and metrics',
      icon: TrendingUp,
    },
    {
      key: 'settings' as ActiveTab,
      label: 'Settings & Cloud Sync',
      description: 'Account, Firebase cloud database, and backups',
      icon: Settings,
    },
  ];

  const isMoreActive = ['finances', 'habits', 'notes', 'insights', 'settings'].includes(
    normalizedActive
  );

  // Close more menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMoreOpen) {
        setIsMobileMoreOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setIsMobileMoreOpen(false);
      }
    };

    if (isMobileMoreOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMoreOpen]);

  const handleSelect = (tab: ActiveTab) => {
    onSelectTab(tab);
    setIsMobileMoreOpen(false);
  };

  return (
    <>
      <nav
        id="primary-app-nav"
        aria-label="Main Navigation"
        className="bg-white border-b border-slate-200 sticky top-16 z-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Navigation (>= md) */}
          <div className="hidden md:flex items-center justify-between py-2">
            {/* Primary Navigation Items */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {desktopPrimaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = normalizedActive === tab.key;

                return (
                  <button
                    key={tab.key}
                    id={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelect(tab.key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                          tab.badgeColor ||
                          (isActive ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800')
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider and Secondary Navigation Items */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              {desktopSecondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = normalizedActive === tab.key;

                return (
                  <button
                    key={tab.key}
                    id={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelect(tab.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Navigation (< md): 5 Touch-Friendly Items */}
          <div className="md:hidden flex items-center justify-around py-2">
            {mobilePrimaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = normalizedActive === tab.key;

              return (
                <button
                  key={tab.key}
                  id={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelect(tab.key)}
                  className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] min-w-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {tab.badge && (
                      <span className="absolute -top-1.5 -right-2.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </div>
                  <span className="text-[11px] mt-1">{tab.label}</span>
                </button>
              );
            })}

            {/* Mobile "More" Tab */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                id="mobile-nav-more"
                aria-haspopup="true"
                aria-expanded={isMobileMoreOpen}
                aria-label="More navigation items"
                onClick={() => setIsMobileMoreOpen((prev) => !prev)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] min-w-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isMoreActive || isMobileMoreOpen
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <MoreHorizontal
                  className={`w-4 h-4 ${
                    isMoreActive || isMobileMoreOpen ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span className="text-[11px] mt-1">More</span>
              </button>

              {/* Mobile "More" Dropdown / Bottom Sheet */}
              {isMobileMoreOpen && (
                <div
                  id="mobile-more-disclosure"
                  aria-label="More navigation options"
                  className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-1">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      More Areas
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMobileMoreOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                      aria-label="Close menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {mobileMoreTabs.map((item) => {
                      const Icon = item.icon;
                      const isActive = normalizedActive === item.key;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleSelect(item.key)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                            isActive
                              ? 'bg-slate-100 text-slate-900 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                isActive
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold">{item.label}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};
