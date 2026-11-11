import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import FamilyLogin from './pages/FamilyLogin';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { takeInviteCode } from '@/lib/invite';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// An invite link opened while already signed in would otherwise do nothing.
function InviteNotice() {
  const { familyCode } = useAuth();
  useEffect(() => {
    const code = takeInviteCode();
    if (!code) return;
    if (code === (familyCode || '').toUpperCase()) {
      toast.info("You're already in this family.");
    } else {
      toast.info('That invite is for another family. Log out first, then open the link again to join it.', { duration: 8000 });
    }
  }, [familyCode]);
  return null;
}

const AuthenticatedApp = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <FamilyLogin />;
  }

  return (
    <>
    <InviteNotice />
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </>
  );
};


const TOAST_BOTTOM = 'calc(64px + env(safe-area-inset-bottom) + 16px)';

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        {/* Bottom centre so messages never cover the top nav, raised above the
            bottom tab bar. Sonner's mobile offset only covers up to 600px but
            the tab bar shows below 640px, so both offsets clear it. */}
        <Toaster position="bottom-center" offset={{ bottom: TOAST_BOTTOM }} mobileOffset={{ bottom: TOAST_BOTTOM }} />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
