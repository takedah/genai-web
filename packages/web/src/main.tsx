import { App } from './App.tsx';
import './index.css';
import { Authenticator } from '@aws-amplify/ui-react';
import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router';
import { AuthWithSAML } from '@/components/auth/AuthWithSAML';
import { AuthWithUserpool } from '@/components/auth/AuthWithUserpool';
import { OnlineStatusProvider } from '@/components/OnlineStatusProvider';
import { GlobalErrorFallback } from '@/components/ui/GlobalErrorFallback';

const samlAuthEnabled: boolean = import.meta.env.VITE_APP_SAMLAUTH_ENABLED === 'true';

const AuthWrapper = ({ children }: { children: ReactNode }) => {
  return samlAuthEnabled ? (
    <AuthWithSAML>{children}</AuthWithSAML>
  ) : (
    <AuthWithUserpool>{children}</AuthWithUserpool>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OnlineStatusProvider>
      <Authenticator.Provider>
        <AuthWrapper>
          <BrowserRouter>
            <ErrorBoundary
              fallbackRender={GlobalErrorFallback}
              onReset={() => window.location.reload()}
            >
              <App />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthWrapper>
      </Authenticator.Provider>
    </OnlineStatusProvider>
  </React.StrictMode>,
);
