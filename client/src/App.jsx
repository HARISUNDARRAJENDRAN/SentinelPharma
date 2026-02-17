// App.jsx
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { ResearchProvider } from './context/ResearchContext';
import { ModelProvider } from './context/ModelContext';

import Navbar from './components/layout/Navbar';

import ResearchDashboard from './pages/ResearchDashboard';
import ReportPreview from './pages/ReportPreview';

/**
 * SentinelPharma Application - App.jsx
 * - Wraps app with ThemeProvider + ResearchProvider + ModelProvider
 * - Uses react-router v6 createBrowserRouter + RouterProvider
 * - Keeps Layout used by each route so navbar/footer remain consistent
 */

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#08101a] transition-colors">
      {/* Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#071018] border-t border-gray-200 dark:border-white/6 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-500 dark:text-gray-300 text-sm">
          © 2024 SentinelPharma. Enterprise AI for Drug Repurposing.
        </div>
      </footer>
    </div>
  );
}

// Create router (you already had this - kept same routes)
const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout><ResearchDashboard /></Layout>,
    },
    {
      path: "/report/:requestId",
      element: <Layout><ReportPreview /></Layout>,
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

function App() {
  return (
    // ThemeProvider at the top so entire app can read theme
    <ThemeProvider defaultMode="auto">
      {/* ModelProvider for AI model selection */}
      <ModelProvider>
        {/* ResearchProvider wraps the app so ResearchDashboard and children can use ResearchContext */}
        <ResearchProvider>
          {/* RouterProvider renders the routes configured above */}
          <RouterProvider router={router} />
        </ResearchProvider>
      </ModelProvider>
    </ThemeProvider>
  );
}

export default App;
