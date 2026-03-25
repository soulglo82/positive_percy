import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Gift, Activity, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import useRealtimeSync from '@/lib/useRealtimeSync';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_TITLES = {
  ParentDashboard: 'Family',
  ChildView: 'My Rewards',
  Activity: 'Activity',
  Rewards: 'Rewards',
  ParentProfile: 'Settings',
};

export default function Layout({ children, currentPageName }) {
  const { logout, user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  useRealtimeSync(user?.family_code);

  const navItems = [
    { name: 'ParentDashboard', label: 'Home', icon: Home },
    { name: 'ChildView', label: 'Child', icon: User },
    { name: 'Activity', label: 'Activity', icon: Activity },
    { name: 'Rewards', label: 'Rewards', icon: Gift },
    { name: 'ParentProfile', label: 'Settings', icon: Settings },
  ];

  const pageTitle = PAGE_TITLES[currentPageName] || '';

  return (
    <div className="min-h-screen flex flex-col pb-16 sm:pb-0">
      {/* Desktop top nav — hidden on mobile */}
      <nav className="hidden sm:block bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <Link
                to={createPageUrl('ParentDashboard')}
                className="flex items-center gap-2 shrink-0"
              >
                <img
                  src="/logo.png"
                  alt="Positive Percy"
                  className="h-10 min-w-[120px] w-auto object-contain"
                />
                <span className="text-base font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent whitespace-nowrap">
                  Positive Percy
                </span>
              </Link>
              {pageTitle && (
                <span className="text-xs font-medium text-slate-400">
                  / {pageTitle}
                </span>
              )}
            </div>

            <div className="flex gap-1 items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.name;

                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all ml-1"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top header — visible on mobile only */}
      <header className="sm:hidden bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-12">
          <Link to={createPageUrl('ParentDashboard')} className="flex items-center gap-2">
            <img src="/logo.png" alt="Positive Percy" className="h-8 w-auto object-contain" />
            <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              Positive Percy
            </span>
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.name;

            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-all min-h-[48px] ${
                  isActive
                    ? 'text-purple-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-purple-600' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of Positive Percy?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={logout}
              className="bg-red-500 hover:bg-red-600"
            >
              Yes, log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
