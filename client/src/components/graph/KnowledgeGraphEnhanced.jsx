/**
 * Enhanced SentinelPharma Knowledge Graph
 * ====================================
 * Advanced interactive knowledge graph with:
 * - Force-directed physics simulation
 * - Interactive filtering and clustering
 * - Path highlighting
 * - Node details with metadata
 * - Export functionality
 * - 3D-like depth visualization
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  X,
  Pill,
  Dna,
  Activity,
  AlertCircle,
  Info,
  Download,
  Filter,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';

const KnowledgeGraphEnhanced = ({ data, graphData, molecule }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [highlightedPath, setHighlightedPath] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showLabels, setShowLabels] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const animationRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Enhanced mock data generator
  const generateEnhancedGraph = useCallback((stats) => {
    const mockNodes = [];
    const mockEdges = [];
    
    // Central drug node
    mockNodes.push({
      id: 'drug_0',
      label: molecule || 'Drug',
      type: 'drug',
      color: '#8B5CF6',
      size: 25,
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      connections: 0,
      metadata: {
        type: 'Small Molecule',
        mw: '342.34 g/mol',
        indication: 'Oncology'
      }
    });

    // Generate protein targets with clustering
    const targetCount = 8;
    for (let i = 0; i < targetCount; i++) {
      const angle = (i / targetCount) * 2 * Math.PI;
      const radius = 120;
      mockNodes.push({
        id: `target_${i}`,
        label: ['EGFR', 'VEGFR2', 'mTOR', 'PI3K', 'AKT', 'BRAF', 'MEK', 'ERK'][i] || `Target ${i + 1}`,
        type: 'protein',
        color: '#10B981',
        size: 18,
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        connections: 0,
        metadata: {
          family: 'Kinase',
          expression: i % 2 === 0 ? 'High' : 'Medium',
          druggability: Math.random() > 0.3 ? 'High' : 'Medium'
        }
      });
      mockEdges.push({
        source: 'drug_0',
        target: `target_${i}`,
        type: 'binds',
        strength: Math.random(),
        weight: 2
      });
    }

    // Generate pathways
    const pathways = [
      { name: 'MAPK/ERK', related: [2, 5, 6, 7] },
      { name: 'PI3K/AKT/mTOR', related: [2, 3, 4] },
      { name: 'Angiogenesis', related: [1, 2] },
      { name: 'Apoptosis', related: [0, 3, 4] }
    ];

    pathways.forEach((pathway, i) => {
      const angle = (i / pathways.length) * 2 * Math.PI + Math.PI / 6;
      const radius = 220;
      mockNodes.push({
        id: `pathway_${i}`,
        label: pathway.name,
        type: 'pathway',
        color: '#F59E0B',
        size: 20,
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        connections: 0,
        metadata: {
          genes: pathway.related.length,
          relevance: Math.random() > 0.5 ? 'High' : 'Medium'
        }
      });
      
      // Connect pathways to targets
      pathway.related.forEach(targetIdx => {
        mockEdges.push({
          source: `target_${targetIdx}`,
          target: `pathway_${i}`,
          type: 'regulates',
          strength: Math.random() * 0.5 + 0.5,
          weight: 1.5
        });
      });
    });

    // Generate disease nodes
    const diseases = ['Cancer', 'Inflammation', 'Fibrosis'];
    diseases.forEach((disease, i) => {
      const angle = (i / diseases.length) * 2 * Math.PI - Math.PI / 4;
      const radius = 300;
      mockNodes.push({
        id: `disease_${i}`,
        label: disease,
        type: 'disease',
        color: '#EF4444',
        size: 22,
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        connections: 0,
        metadata: {
          prevalence: i === 0 ? 'High' : 'Medium',
          severity: 'High'
        }
      });
      
      // Connect diseases to pathways
      const pathwayIndices = i === 0 ? [0, 1] : i === 1 ? [0, 2] : [1, 3];
      pathwayIndices.forEach(pIdx => {
        mockEdges.push({
          source: `pathway_${pIdx}`,
          target: `disease_${i}`,
          type: 'associated_with',
          strength: Math.random() * 0.3 + 0.7,
          weight: 2
        });
      });
    });

    // Calculate connections for sizing
    mockEdges.forEach(edge => {
      const source = mockNodes.find(n => n.id === edge.source);
      const target = mockNodes.find(n => n.id === edge.target);
      if (source) source.connections++;
      if (target) target.connections++;
    });

    return { nodes: mockNodes, edges: mockEdges };
  }, [molecule]);

  // Initialize graph
  useEffect(() => {
    if (graphData?.nodes) {
      setNodes(graphData.nodes);
      setEdges(graphData.edges || []);
    } else {
      const generated = generateEnhancedGraph(data || {});
      setNodes(generated.nodes);
      setEdges(generated.edges);
    }
  }, [graphData, data, generateEnhancedGraph]);

  // Physics simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const simulate = () => {
      setNodes(prevNodes => {
        const newNodes = [...prevNodes];
        
        // Apply forces
        newNodes.forEach((node, i) => {
          let fx = 0, fy = 0;
          
          // Repulsion between nodes
          newNodes.forEach((other, j) => {
            if (i !== j) {
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = 5000 / (dist * dist);
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          });
          
          // Attraction along edges
          edges.forEach(edge => {
            if (edge.source === node.id) {
              const target = newNodes.find(n => n.id === edge.target);
              if (target) {
                const dx = target.x - node.x;
                const dy = target.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 100) * 0.01 * (edge.weight || 1);
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
              }
            }
            if (edge.target === node.id) {
              const source = newNodes.find(n => n.id === edge.source);
              if (source) {
                const dx = source.x - node.x;
                const dy = source.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 100) * 0.01 * (edge.weight || 1);
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
              }
            }
          });
          
          // Center attraction
          const centerX = 400;
          const centerY = 300;
          const dx = centerX - node.x;
          const dy = centerY - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += (dx / dist) * 0.5;
          fy += (dy / dist) * 0.5;
          
          // Apply forces with damping
          node.vx = (node.vx + fx) * 0.85;
          node.vy = (node.vy + fy) * 0.85;
          node.x += node.vx;
          node.y += node.vy;
          
          // Boundary constraints
          node.x = Math.max(50, Math.min(750, node.x));
          node.y = Math.max(50, Math.min(550, node.y));
        });
        
        return newNodes;
      });
      
      animationRef.current = requestAnimationFrame(simulate);
    };

    // Run simulation for 300 frames, then slow down
    let frameCount = 0;
    const limitedSimulate = () => {
      simulate();
      frameCount++;
      if (frameCount < 300) {
        requestAnimationFrame(limitedSimulate);
      }
    };
    
    limitedSimulate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [edges]);

  // Filter nodes based on type
  const filteredNodes = useMemo(() => {
    let filtered = nodes;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(n => 
        n.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [nodes, filterType, searchTerm]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply transforms
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (source && target) {
        const isHighlighted = highlightedPath.includes(edge.source) && highlightedPath.includes(edge.target);
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted ? '#8B5CF6' : `rgba(203, 213, 225, ${edge.strength || 0.5})`;
        ctx.lineWidth = isHighlighted ? 3 : 1.5 * (edge.weight || 1);
        ctx.stroke();
        
        // Draw arrow
        if (isHighlighted) {
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          const arrowSize = 8;
          ctx.fillStyle = '#8B5CF6';
          ctx.beginPath();
          ctx.moveTo(
            target.x - arrowSize * Math.cos(angle - Math.PI / 6),
            target.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(target.x, target.y);
          ctx.lineTo(
            target.x - arrowSize * Math.cos(angle + Math.PI / 6),
            target.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.fill();
        }
      }
    });

    // Draw nodes
    filteredNodes.forEach(node => {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isInPath = highlightedPath.includes(node.id);
      const radius = (node.size || 18) * (isSelected ? 1.3 : isHovered ? 1.15 : 1);

      // Node shadow for depth
      if (isSelected || isHovered || isInPath) {
        ctx.beginPath();
        ctx.arc(node.x + 2, node.y + 2, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      
      // Gradient fill
      const gradient = ctx.createRadialGradient(node.x - radius / 3, node.y - radius / 3, 0, node.x, node.y, radius);
      gradient.addColorStop(0, lightenColor(node.color, 20));
      gradient.addColorStop(1, node.color);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Node border
      if (isSelected || isHovered || isInPath) {
        ctx.strokeStyle = isSelected ? '#1F2937' : isInPath ? '#8B5CF6' : '#6B7280';
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.stroke();
      }

      // Connection indicator
      if (node.connections > 0) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.connections, node.x, node.y);
      }

      // Node label
      if (showLabels || isHovered || isSelected) {
        ctx.fillStyle = '#1F2937';
        ctx.font = `${isSelected ? 'bold ' : ''}12px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Label background
        const textWidth = ctx.measureText(node.label).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(node.x - textWidth / 2 - 4, node.y + radius + 3, textWidth + 8, 18);
        
        ctx.fillStyle = '#1F2937';
        ctx.fillText(node.label, node.x, node.y + radius + 6);
      }
    });

    ctx.restore();
  }, [nodes, edges, zoom, pan, hoveredNode, selectedNode, showLabels, highlightedPath, filteredNodes]);

  // Helper function to lighten colors
  const lightenColor = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  // Mouse handlers
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedNode = filteredNodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < (node.size || 18);
    });

    if (clickedNode) {
      setSelectedNode(selectedNode?.id === clickedNode.id ? null : clickedNode);
      
      // Highlight connected nodes
      const connected = [clickedNode.id];
      edges.forEach(edge => {
        if (edge.source === clickedNode.id) connected.push(edge.target);
        if (edge.target === clickedNode.id) connected.push(edge.source);
      });
      setHighlightedPath(connected);
    } else {
      setSelectedNode(null);
      setHighlightedPath([]);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const hoveredNode = filteredNodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < (node.size || 18);
    });

    setHoveredNode(hoveredNode);
    canvas.style.cursor = hoveredNode ? 'pointer' : isPanning ? 'grabbing' : 'grab';
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'drug': return Pill;
      case 'protein': return Dna;
      case 'pathway': return Activity;
      case 'disease': return AlertCircle;
      default: return Network;
    }
  };

  const nodeTypes = [
    { id: 'all', label: 'All Nodes', count: nodes.length },
    { id: 'drug', label: 'Drugs', count: nodes.filter(n => n.type === 'drug').length },
    { id: 'protein', label: 'Proteins', count: nodes.filter(n => n.type === 'protein').length },
    { id: 'pathway', label: 'Pathways', count: nodes.filter(n => n.type === 'pathway').length },
    { id: 'disease', label: 'Diseases', count: nodes.filter(n => n.type === 'disease').length }
  ];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-600 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-700 dark:to-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-lg flex items-center justify-center shadow-lg dark:shadow-indigo-900/50">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interactive Knowledge Graph</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Drug-Target-Pathway-Disease relationships</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.2))}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Reset View */}
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Reset View"
            >
              <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Toggle Labels */}
            <button
              onClick={() => setShowLabels(!showLabels)}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title={showLabels ? 'Hide Labels' : 'Show Labels'}
            >
              {showLabels ? <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
            </button>
            
            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <X className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
            </button>
            
            {/* Export */}
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                const link = document.createElement('a');
                link.download = `knowledge-graph-${molecule || 'drug'}.png`;
                link.href = canvas.toDataURL();
                link.click();
              }}
              className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Export as Image"
            >
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
            />
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center space-x-1">
            {nodeTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === type.id
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                {type.label} ({type.count})
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex">
        {/* Graph Canvas */}
        <div className={`flex-1 ${isFullscreen ? 'h-[calc(100vh-16rem)]' : 'h-[500px]'} bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 relative`}>
          <canvas
            ref={canvasRef}
            width={isFullscreen ? window.innerWidth - 400 : 800}
            height={isFullscreen ? window.innerHeight - 256 : 500}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-xl p-3 shadow-lg border border-gray-200 dark:border-slate-600">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Layers className="w-3 h-3 mr-1" />
              Node Types
            </div>
            <div className="space-y-1.5">
              {[
                { type: 'drug', color: '#8B5CF6', label: 'Drug' },
                { type: 'protein', color: '#10B981', label: 'Protein Target' },
                { type: 'pathway', color: '#F59E0B', label: 'Pathway' },
                { type: 'disease', color: '#EF4444', label: 'Disease' },
              ].map(item => (
                <div key={item.type} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg p-2 shadow-sm border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <div>🖱️ Click & drag to pan</div>
              <div>🔍 Scroll to zoom</div>
              <div>👆 Click node to view details</div>
            </div>
          </div>
        </div>
        
        {/* Node Details Panel */}
        <div className={`${isFullscreen ? 'w-96' : 'w-80'} border-l border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-y-auto`}>
          {selectedNode ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Node Details</h4>
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    setHighlightedPath([]);
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* Node Info */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: selectedNode.color }}
                  >
                    {(() => {
                      const Icon = getNodeIcon(selectedNode.type);
                      return <Icon className="w-6 h-6 text-white" />;
                    })()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{selectedNode.label}</div>
                    <div className="text-sm text-gray-500 capitalize">{selectedNode.type}</div>
                  </div>
                </div>
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Connections</div>
                    <div className="text-xl font-bold text-gray-900">{selectedNode.connections}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Size</div>
                    <div className="text-xl font-bold text-gray-900">{selectedNode.size || 18}</div>
                  </div>
                </div>
                
                {/* Metadata */}
                {selectedNode.metadata && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Metadata</div>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Connected Nodes */}
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Connected Nodes</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {edges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge, i) => {
                        const connectedId = edge.source === selectedNode.id ? edge.target : edge.source;
                        const connectedNode = nodes.find(n => n.id === connectedId);
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedNode(connectedNode)}
                            className="w-full text-left text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1.5 flex justify-between items-center transition-colors"
                          >
                            <span className="font-medium text-gray-700">{connectedNode?.label || connectedId}</span>
                            <span className="text-gray-400 text-xs">{edge.type}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
              <Info className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Click a node to view details</p>
              <p className="text-xs mt-1">Connections will be highlighted</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{nodes.length}</div>
            <div className="text-xs text-gray-500">Total Nodes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{edges.length}</div>
            <div className="text-xs text-gray-500">Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{nodes.filter(n => n.type === 'pathway').length}</div>
            <div className="text-xs text-gray-500">Pathways</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{nodes.filter(n => n.type === 'protein').length}</div>
            <div className="text-xs text-gray-500">Targets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-700">{nodes.filter(n => n.type === 'disease').length}</div>
            <div className="text-xs text-gray-500">Diseases</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphEnhanced;
