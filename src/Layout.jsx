import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Gift, Activity, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/brand/Logo';
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
  const { logout, user, familyCode } = useAuth();
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
      {/* Desktop top nav, hidden on mobile */}
      <nav className="hidden sm:block bg-card border-b border-border sticky top-0 z-50" aria-label="Main">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link
                to={createPageUrl('ParentDashboard')}
                className="flex items-center min-h-11 rounded-md shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Logo size={32} wordmark />
              </Link>
              {pageTitle && (
                <span className="text-sm font-medium text-muted-foreground">
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
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 min-h-10 touch:min-h-11 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-selected text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center justify-center h-10 w-10 touch:h-11 touch:w-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top header, visible on mobile only */}
      <header className="sm:hidden bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between pl-4 pr-1 h-12">
          <Link to={createPageUrl('ParentDashboard')} className="flex items-center min-h-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Logo size={32} wordmark />
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center justify-center h-11 w-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 page-in">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom" aria-label="Main">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.name;

            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 rounded-md transition-colors min-h-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-selected text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {/* Icon in brand orange (3:1 is enough for an icon); the label stays ink (4.24 in orange). */}
                <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-primary' : ''}`} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-xs">
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
              You'll need your family code to sign back in. Make sure another grown-up has it, or save it somewhere safe before signing out.
            </AlertDialogDescription>
            {familyCode && (
              <div className="rounded-md border border-border bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">Your family code</p>
                <p className="font-mono text-lg font-semibold text-foreground select-all">{familyCode}</p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={logout}
              variant="destructive"
            >
              Yes, log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
