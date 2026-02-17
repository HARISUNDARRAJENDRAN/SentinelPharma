// ResearchDashboard.jsx
/**
 * SentinelPharma Research Dashboard
 * ==============================
 * Main dashboard for drug repurposing analysis.
 *
 * NOTE: uses the safe `useResearch()` hook from ResearchContext
 * which returns safe defaults when the provider is missing.
 */

import { useState } from 'react';
import {
  Search,
  Loader2,
  Brain,
  TrendingUp,
  FileText,
  Eye,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Users,
  Network,
  Ship,
  BarChart3,
  Globe,
  Database,
  ChevronDown,
  Sparkles
} from 'lucide-react';

// Use the safe hook exported from ResearchContext (returns fallbacks when provider missing)
import { useResearch } from '../context/ResearchContext';
import { useModel } from '../context/ModelContext';

import { researchService } from '../services/api';
import AgentStatusCard from '../components/dashboard/AgentStatusCard';
import AgentDetailPanel from '../components/dashboard/AgentDetailPanel';
import ComprehensiveSummary from '../components/dashboard/ComprehensiveSummary';
import AutoSuggestInput from '../components/dashboard/AutoSuggestInput';
import CitationPanel from '../components/dashboard/CitationPanel';
import ReportGenerator from '../components/dashboard/ReportGenerator';
import WatchAlertModule from '../components/dashboard/WatchAlertModule';
import KnowledgeGraphEnhanced from '../components/graph/KnowledgeGraphEnhanced';
import StrategySelector from '../components/StrategySelector';

const ResearchDashboard = () => {
  // useResearch gives safe defaults if provider isn't present
  const { privacyMode } = useResearch();
  const { selectedModel } = useModel(); // Get selected model from ModelContext

  const [drugName, setDrugName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showGraph, setShowGraph] = useState(false);
  const [activeTab, setActiveTab] = useState('results'); // 'results', 'graph', 'citations', 'watch'
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showStrategySelector, setShowStrategySelector] = useState(false);

  // 7 Mandatory Agents + 3 Strategic Agents (EY Focus)
  const [agentStatuses, setAgentStatuses] = useState([
    { name: 'Master Orchestrator', status: 'idle', icon: Brain, key: 'orchestrator', color: 'indigo', category: 'core' },
    { name: 'IQVIA Insights Agent', status: 'idle', icon: BarChart3, key: 'iqvia', color: 'blue', category: 'mandatory' },
    { name: 'EXIM Trends Agent', status: 'idle', icon: Ship, key: 'exim', color: 'cyan', category: 'mandatory' },
    { name: 'Patent Landscape Agent', status: 'idle', icon: FileText, key: 'patent', color: 'purple', category: 'mandatory' },
    { name: 'Clinical Trials Agent', status: 'idle', icon: Shield, key: 'clinical', color: 'green', category: 'mandatory' },
    { name: 'Internal Knowledge Agent', status: 'idle', icon: Database, key: 'internal', color: 'orange', category: 'mandatory' },
    { name: 'Web Intelligence Agent', status: 'idle', icon: Globe, key: 'web_intel', color: 'pink', category: 'mandatory' },
    { name: 'Regulatory Compliance', status: 'idle', icon: Shield, key: 'regulatory', color: 'red', category: 'strategic' },
    { name: 'Patient Sentiment', status: 'idle', icon: Users, key: 'patient_sentiment', color: 'rose', category: 'strategic' },
    { name: 'ESG & Sustainability', status: 'idle', icon: TrendingUp, key: 'esg', color: 'emerald', category: 'strategic' }
  ]);

  /**
   * Handle research form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!drugName.trim()) {
      setError('Please enter a drug or molecule name');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);
    setSelectedAgent(null);
    setActiveTab('agents');

    // update statuses to thinking
    setAgentStatuses(prev => prev.map(agent => ({ ...agent, status: 'thinking' })));

    try {
      // Actual API call with selected model provider
      const response = await researchService.analyze(drugName, privacyMode, selectedModel);

      setResults(response.data);

      // Map backend agent keys to frontend agent names
      const backendToFrontendMap = {
        'orchestrator': 'Master Orchestrator',
        'iqvia': 'IQVIA Insights Agent',
        'exim': 'EXIM Trends Agent',
        'patent': 'Patent Landscape Agent',
        'clinical': 'Clinical Trials Agent',
        'internal_knowledge': 'Internal Knowledge Agent',
        'web_intelligence': 'Web Intelligence Agent',
        'regulatory': 'Regulatory Compliance',
        'patient_sentiment': 'Patient Sentiment',
        'esg': 'ESG & Sustainability'
      };

      // Update agent statuses based on actual API response
      setAgentStatuses(prev => prev.map(agent => {
        // Find the backend key for this agent
        const backendKey = Object.entries(backendToFrontendMap).find(
          ([key, name]) => name === agent.name
        )?.[0];

        // Check if data exists for this agent
        const hasData = backendKey && response.data?.results?.[backendKey];
        
        return {
          ...agent,
          status: hasData ? 'completed' : 'idle'
        };
      }));

      setActiveTab('agents');
    } catch (err) {
      console.error('Research failed:', err);
      setError(err.response?.data?.error || 'Failed to process research request');
      setAgentStatuses(prev => prev.map(agent => ({ ...agent, status: 'error' })));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStrategySelect = (query) => {
    setDrugName(query.molecule);
    setShowStrategySelector(false);
  };

  const handleAgentClick = (agent) => {
    if (agent.status === 'completed') {
      setSelectedAgent(selectedAgent === agent.name ? null : agent.name);
    }
  };

  const getAgentData = (agentName) => {
    if (!results?.results) return null;

    const keyMap = {
      'Master Orchestrator': 'orchestrator',
      'IQVIA Insights Agent': 'iqvia',
      'EXIM Trends Agent': 'exim',
      'Patent Landscape Agent': 'patent',
      'Clinical Trials Agent': 'clinical',
      'Internal Knowledge Agent': 'internal_knowledge',
      'Web Intelligence Agent': 'web_intelligence',
      'Regulatory Compliance': 'regulatory',
      'Patient Sentiment': 'patient_sentiment',
      'ESG & Sustainability': 'esg'
    };

    return results.results[keyMap[agentName]] || null;
  };

  const handleReset = () => {
    setDrugName('');
    setResults(null);
    setError(null);
    setSelectedAgent(null);
    setActiveTab('agents');
    setAgentStatuses(prev => prev.map(agent => ({ ...agent, status: 'idle' })));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
          <Sparkles className="w-8 h-8 mr-3 text-indigo-500 dark:text-indigo-400" />
          Drug Repurposing Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Enter a drug or molecule name to analyze with our 10 specialized AI agents
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-2xl p-6 border border-gray-100 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowStrategySelector(!showStrategySelector)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Use Strategic Query Library
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showStrategySelector ? 'rotate-180' : ''}`} />
            </button>
            {showStrategySelector && (
              <div className="mt-3">
                <StrategySelector onSelectQuery={handleStrategySelect} />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <AutoSuggestInput
                value={drugName}
                onChange={setDrugName}
                onSelect={(value) => setDrugName(value)}
                placeholder="Enter drug name (e.g., Aspirin, Metformin, Imatinib, Semaglutide)"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !drugName.trim()}
              className={`px-8 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center space-x-2 shadow-lg ${
                isLoading || !drugName.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : privacyMode === 'secure'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>Analyze with 10 Agents</span>
                </>
              )}
            </button>
          </div>

          {/* Mode Indicator */}
          <div className={`text-sm text-center py-3 rounded-xl flex items-center justify-center space-x-2 ${
            privacyMode === 'secure'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          }`}>
            <Shield className="w-4 h-4" />
            <span>
              Processing in <strong>{privacyMode === 'secure' ? 'Local Secure Mode (Llama 3)' : 'Cloud Mode (Gemini)'}</strong>
            </span>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Agent Status Cards */}
      {(isLoading || results) && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-2xl p-6 space-y-5 border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center mr-3 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
                  <Users className="w-5 h-5 text-white" />
                </div>
                AI Agent Overview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                Click on any completed agent to view detailed analysis
              </p>
            </div>
            {results && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <span className="text-sm text-green-700 font-medium flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {agentStatuses.filter(a => a.status === 'completed').length} of {agentStatuses.length} agents completed
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-4">
            {agentStatuses.map((agent, index) => (
              <AgentStatusCard
                key={agent.name}
                name={agent.name}
                status={agent.status}
                icon={agent.icon}
                delay={index * 80}
                onClick={() => handleAgentClick(agent)}
                isSelected={selectedAgent === agent.name}
                hasResults={!!getAgentData(agent.name) || agent.status === 'completed'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Agents Thinking...
          </h3>
          <p className="text-gray-600">
            Our AI agents are analyzing {drugName} for repurposing opportunities
          </p>
          <div className="mt-6 flex justify-center">
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 bg-blue-500 rounded-full agent-thinking"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && !isLoading && (
        <div className="space-y-6">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 dark:from-emerald-600 dark:via-green-600 dark:to-teal-600 rounded-2xl p-1 shadow-lg shadow-green-200 dark:shadow-green-900/50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 dark:from-emerald-500 dark:to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-green-900/50">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Analysis Complete!</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                    <span className="font-medium text-emerald-600">{drugName}</span> analyzed successfully •
                    <span className="text-gray-400 ml-1">{results.results?.processingTimeMs || 0}ms</span>
                  </p>
                </div>
              </div>
              <ReportGenerator
                data={results}
                molecule={drugName}
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 p-1">
              <div className="bg-white dark:bg-slate-800 rounded-t-xl">
                <nav className="flex space-x-1 p-3 overflow-x-auto">
                  {[
                    { id: 'results', label: 'Summary & ROI', icon: TrendingUp, color: 'emerald' },
                    { id: 'graph', label: 'Knowledge Graph', icon: Network, color: 'blue' },
                    { id: 'citations', label: 'Citations', icon: FileText, color: 'purple' },
                    { id: 'watch', label: 'Watch & Alert', icon: Eye, color: 'orange' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-200 scale-105`
                          : 'text-gray-600 hover:bg-gray-100 hover:scale-102'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Results Tab */}
              {activeTab === 'results' && (
                <div className="space-y-6">
                  <ComprehensiveSummary agentResults={results.results} molecule={drugName} />
                </div>
              )}

              {activeTab === 'graph' && (
                <KnowledgeGraphEnhanced
                  molecule={drugName}
                  data={results.results?.vision}
                  graphData={results.results?.vision?.knowledge_graph}
                />
              )}

              {activeTab === 'citations' && (
                <CitationPanel
                  agentResults={results.results}
                  molecule={drugName}
                />
              )}

              {activeTab === 'watch' && (
                <WatchAlertModule
                  agentResults={results.results}
                  molecule={drugName}
                />
              )}
            </div>
          </div>

          {/* New Research Button */}
          <div className="text-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-medium text-gray-700 dark:text-gray-200 transition-colors"
            >
              Start New Research
            </button>
          </div>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={agentStatuses.find(a => a.name === selectedAgent)}
          data={getAgentData(selectedAgent)}
          onClose={() => setSelectedAgent(null)}
          molecule={drugName}
        />
      )}
    </div>
  );
};

export default ResearchDashboard;
