// Version: 2.0.5 - Vercel SPA Routing Fix
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './utils/languageContext.tsx';
import { RoleProvider } from './utils/RoleContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
