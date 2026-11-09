import React from 'react';
import { createRoot } from 'react-dom/client';
import { DesktopGate } from './DesktopGate';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/arabic-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DesktopGate /></React.StrictMode>,
);
