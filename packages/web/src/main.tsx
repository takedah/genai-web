import { App } from './App.tsx';
import './index.css';
import { Authenticator } from '@aws-amplify/ui-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router';
import { AuthWithUserpool } from '@/components/auth/AuthWithUserpool';
import { OnlineStatusProvider } from '@/components/OnlineStatusProvider';
import { GlobalErrorFallback } from '@/components/ui/GlobalErrorFallback';

// 閉域構成では Cognito Hosted UI（SAML 認証）が使えないため、ユーザープール認証に固定
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OnlineStatusProvider>
      <Authenticator.Provider>
        <AuthWithUserpool>
          <BrowserRouter>
            <ErrorBoundary
              fallbackRender={GlobalErrorFallback}
              onReset={() => window.location.reload()}
            >
              <App />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthWithUserpool>
      </Authenticator.Provider>
    </OnlineStatusProvider>
  </React.StrictMode>,
);
