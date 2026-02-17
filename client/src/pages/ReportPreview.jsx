/**
 * SentinelPharma Report Preview Page
 * ===============================
 * Detailed view of research analysis results.
 */

import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Share2 } from 'lucide-react';

const ReportPreview = () => {
  const { requestId } = useParams();
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Navigation */}
      <Link 
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>
      
      {/* Report Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Research Report
          </h1>
          <div className="flex space-x-3">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Request ID: {requestId}
        </div>
      </div>
      
      {/* Report Content Placeholder */}
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">
        <p>Full report view coming soon...</p>
        <p className="mt-2 text-sm">
          This page will display the complete analysis report with 
          Knowledge Graph visualization, detailed agent outputs, and 
          exportable documentation.
        </p>
      </div>
    </div>
  );
};

export default ReportPreview;
