/**
 * SentinelPharma Navbar Component
 * ============================
 * Top navigation bar with AI Model toggle and Theme switch.
 * 
 * Features:
 * - Logo and branding
 * - Privacy toggle: Secure (Llama 3) ↔ Cloud (Gemini)
 * - Theme toggle: Light ↔ Dark mode
 * - Visual status indicators
 * - Mobile responsive
 */

import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Cloud, 
  Menu, 
  X, 
  Beaker, 
  Settings,
  Bell,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { ResearchContext } from '../../context/ResearchContext';
import { useTheme } from '../../context/ThemeContext';
import { useModel } from '../../context/ModelContext';

const Navbar = () => {
  const { privacyMode, setPrivacyMode } = useContext(ResearchContext);
  const { mode, toggle } = useTheme();
  const { selectedModel, setSelectedModel } = useModel();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Toggle between Gemini (cloud) and Ollama (local)
  const handleModelToggle = () => {
    const newModel = selectedModel === 'ollama' ? 'gemini' : 'ollama';
    setSelectedModel(newModel);
  };
  
  const isLocalModel = selectedModel === 'ollama';
  
  return (
    <nav className="bg-white dark:bg-[#071018] shadow-sm border-b border-gray-200 dark:border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Beaker className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">SentinelPharma</span>
              <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">Drug Repurposing AI</span>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Theme Toggle - Enhanced Day/Night Switch */}
            <button
              onClick={toggle}
              className="relative w-16 h-8 rounded-full transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:ring-offset-slate-900 focus:ring-indigo-500 overflow-hidden group shadow-lg hover:shadow-xl transform hover:scale-105"
              style={{
                background: mode === 'dark' 
                  ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)' 
                  : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)'
              }}
              aria-label="Toggle theme"
            >
              {/* Sky background effect with animation */}
              <div className="absolute inset-0 transition-all duration-500">
                {mode === 'dark' ? (
                  // Night sky with stars
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950">
                    <div className="absolute top-1 left-2 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse"></div>
                    <div className="absolute top-3 left-6 w-0.5 h-0.5 bg-white rounded-full opacity-60 animate-pulse" style={{animationDelay: '0.3s'}}></div>
                    <div className="absolute top-2 left-10 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse" style={{animationDelay: '0.6s'}}></div>
                    <div className="absolute top-4 left-4 w-0.5 h-0.5 bg-blue-200 rounded-full opacity-50 animate-pulse" style={{animationDelay: '0.9s'}}></div>
                    <div className="absolute top-1 left-8 w-0.5 h-0.5 bg-purple-200 rounded-full opacity-40 animate-pulse" style={{animationDelay: '1.2s'}}></div>
                  </div>
                ) : (
                  // Day sky with clouds
                  <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-blue-400 to-blue-500">
                    <div className="absolute top-2 left-4 w-3 h-1 bg-white/30 rounded-full blur-[1px]"></div>
                    <div className="absolute top-4 left-7 w-2 h-1 bg-white/20 rounded-full blur-[1px]"></div>
                  </div>
                )}
              </div>
              
              {/* Toggle Circle (Sun/Moon) with glow effect */}
              <span
                className={`absolute top-1 w-6 h-6 rounded-full shadow-lg transform transition-all duration-500 flex items-center justify-center ${
                  mode === 'dark' 
                    ? 'translate-x-1 bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-900' 
                    : 'translate-x-9 bg-gradient-to-br from-yellow-300 to-orange-400 shadow-yellow-500/50'
                }`}
              >
                {mode === 'dark' ? (
                  <Moon className="w-4 h-4 text-slate-100 drop-shadow-lg" />
                ) : (
                  <Sun className="w-4 h-4 text-white drop-shadow-lg animate-spin-slow" />
                )}
              </span>
            </button>
            
            {/* AI Model Toggle - Gemini vs Ollama */}
            <div className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 border border-gray-200 dark:border-gray-700">
              {/* Ollama Label */}
              <span className={`text-sm font-medium transition-colors ${
                isLocalModel ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`}>
                <Shield className="w-4 h-4 inline mr-1" />
                Ollama
              </span>
              
              {/* Toggle Switch */}
              <button
                onClick={handleModelToggle}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isLocalModel 
                    ? 'bg-green-500 focus:ring-green-500' 
                    : 'bg-blue-500 focus:ring-blue-500'
                }`}
                role="switch"
                aria-checked={isLocalModel}
                aria-label="AI model toggle"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    isLocalModel ? 'translate-x-1' : 'translate-x-7'
                  }`}
                />
              </button>
              
              {/* Gemini Label */}
              <span className={`text-sm font-medium transition-colors ${
                !isLocalModel ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
              }`}>
                Gemini
                <Sparkles className="w-4 h-4 inline ml-1" />
              </span>
            </div>
            
            {/* Mode Status Badge - Shows Active LLM */}
            <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              isLocalModel
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
            }`}>
              {isLocalModel ? '🔒 Llama 3 (Local)' : '✨ Gemini (Cloud)'}
            </div>
            
            {/* Notification Bell */}
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            
            {/* Settings */}
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018]">
            {/* Mobile AI Model Toggle */}
            <div className="flex flex-col space-y-4 px-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Model</span>
                <button
                  onClick={handleModelToggle}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                    isLocalModel ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                      isLocalModel ? 'translate-x-1' : 'translate-x-7'
                    }`}
                  />
                </button>
              </div>
              
              <div className={`text-center py-2 rounded-lg text-sm font-medium ${
                isLocalModel
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              }`}>
                {isLocalModel ? (
                  <span><Shield className="w-4 h-4 inline mr-1" /> Llama 3 (Ollama)</span>
                ) : (
                  <span><Sparkles className="w-4 h-4 inline mr-1" /> Gemini 1.5</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;