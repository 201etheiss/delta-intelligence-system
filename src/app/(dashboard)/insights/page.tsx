'use client';

import { useEffect, useState, useRef } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Network } from 'lucide-react';

interface StatsData {
  nodeCount: number;
  relationshipCount: number;
  labelCounts: Record<string, number>;
  relationshipTypeCounts: Record<string, number>;
}

interface Node {
  id: string;
  label: string;
  name: string;
  group: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
}

interface NetworkData {
  nodes: Node[];
  edges: Edge[];
}

interface Entity {
  entityName: string;
  entityCode: string;
  accountCount: number;
  accountTypes: string[];
}


const BRAND_COLORS = {
  orange: '#FF5C00',
  navy: '#0C2833',
  steel: '#8CAEC1',
  white: '#FFFFFF',
  orangeLight: '#FF8A40',
  steelPale: '#DDE9EE',
  steelDark: '#B5CFD9',
  navyDark: '#122F3D',
};

const NODE_COLORS: Record<string, string> = {
  'Entity': BRAND_COLORS.orange,
  'Account': BRAND_COLORS.navy,
  'CloseTemplate': BRAND_COLORS.steel,
  'JournalTemplate': BRAND_COLORS.orangeLight,
  'ReconRule': BRAND_COLORS.steelDark,
  'default': BRAND_COLORS.steelPale,
};

const PIE_COLORS = [BRAND_COLORS.orange, BRAND_COLORS.navy, BRAND_COLORS.steel, BRAND_COLORS.orangeLight, BRAND_COLORS.steelDark, '#122F3D'];

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-8 bg-[#DDE9EE] rounded w-3/4"></div>
      <div className="h-4 bg-[#DDE9EE] rounded w-1/2"></div>
    </div>
  );
}

function MetricCard({ label, value, bgColor, subtext }: { label: string; value: string | number; bgColor: string; textColor?: string; subtext: string }) {
  return (
    <div className={`${bgColor} rounded-xl p-6 text-white`}>
      <p className="text-xs uppercase tracking-wider font-semibold mb-2 opacity-90">{label}</p>
      <p className={`text-4xl font-bold mb-2`}>{value}</p>
      <p className="text-xs opacity-75">{subtext}</p>
    </div>
  );
}

function ForceGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDimensions = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        setDimensions({ width: rect.width, height: 500 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Initialize positions
    const positions: Record<string, { x: number; y: number }> = {};
    const velocities: Record<string, { x: number; y: number }> = {};

    nodes.forEach((node) => {
      positions[node.id] = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
      };
      velocities[node.id] = { x: 0, y: 0 };
    });

    // Force simulation parameters
    const K = 50; // Spring constant
    const REPULSION = 5000; // Repulsion force
    const DAMPING = 0.85;
    const CENTER_STRENGTH = 0.01;
    const ITERATIONS = 200;

    let iteration = 0;

    const simulate = () => {
      if (iteration >= ITERATIONS) return;
      iteration++;

      // Reset forces
      const forces: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        forces[node.id] = { x: 0, y: 0 };
      });

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          const pos1 = positions[node1.id];
          const pos2 = positions[node2.id];

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = REPULSION / (distance * distance);
          const fx = (force * dx) / distance;
          const fy = (force * dy) / distance;

          forces[node1.id].x -= fx;
          forces[node1.id].y -= fy;
          forces[node2.id].x += fx;
          forces[node2.id].y += fy;
        }
      }

      // Attraction along edges
      edges.forEach((edge) => {
        const pos1 = positions[edge.source];
        const pos2 = positions[edge.target];

        if (!pos1 || !pos2) return;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = (distance * K) / 100;
        const fx = (force * dx) / distance;
        const fy = (force * dy) / distance;

        forces[edge.source].x += fx;
        forces[edge.source].y += fy;
        forces[edge.target].x -= fx;
        forces[edge.target].y -= fy;
      });

      // Center gravity
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      nodes.forEach((node) => {
        const pos = positions[node.id];
        const dx = centerX - pos.x;
        const dy = centerY - pos.y;

        forces[node.id].x += dx * CENTER_STRENGTH;
        forces[node.id].y += dy * CENTER_STRENGTH;

        // Keep nodes in bounds
        if (pos.x < 20) forces[node.id].x += 5;
        if (pos.x > canvas.width - 20) forces[node.id].x -= 5;
        if (pos.y < 20) forces[node.id].y += 5;
        if (pos.y > canvas.height - 20) forces[node.id].y -= 5;
      });

      // Update velocities and positions
      nodes.forEach((node) => {
        const vel = velocities[node.id];
        vel.x = (vel.x + forces[node.id].x) * DAMPING;
        vel.y = (vel.y + forces[node.id].y) * DAMPING;

        const pos = positions[node.id];
        pos.x += vel.x;
        pos.y += vel.y;

        // Boundary constraints
        pos.x = Math.max(20, Math.min(canvas.width - 20, pos.x));
        pos.y = Math.max(20, Math.min(canvas.height - 20, pos.y));
      });

      // Render
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 1;
      edges.forEach((edge) => {
        const pos1 = positions[edge.source];
        const pos2 = positions[edge.target];

        if (pos1 && pos2) {
          ctx.beginPath();
          ctx.moveTo(pos1.x, pos1.y);
          ctx.lineTo(pos2.x, pos2.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        const pos = positions[node.id];
        const nodeColor = NODE_COLORS[node.group] || NODE_COLORS.default;

        // Node circle
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Node border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#0C2833';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.substring(0, 2).toUpperCase(), pos.x, pos.y);
      });

      requestAnimationFrame(simulate);
    };

    simulate();
  }, [nodes, edges, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full border border-[#DDE9EE] rounded-xl bg-white"
      style={{ height: '500px' }}
    />
  );
}

export default function InsightsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, networkRes, entitiesRes] = await Promise.all([
          fetch('/api/graph/stats'),
          fetch('/api/graph/network'),
          fetch('/api/graph/entities'),
        ]);

        const statsData = await statsRes.json();
        const networkData = await networkRes.json();
        const entitiesData = await entitiesRes.json();

        if (statsData.success) setStats(statsData.data);
        if (networkData.success) setNetwork(networkData.data);
        if (entitiesData.success) setEntities(entitiesData.data.relations);
      } catch (error) {
        console.error('Failed to fetch insights data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const labelCountsArray = stats ? Object.entries(stats.labelCounts).map(([name, count]) => ({ name, count })) : [];
  const relationshipCountsArray = stats ? Object.entries(stats.relationshipTypeCounts).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">System Insights</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Real-time knowledge graph analytics and entity relationships</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Graph Statistics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <>
            <SkeletonLoader />
            <SkeletonLoader />
            <SkeletonLoader />
          </>
        ) : (
          <>
            <MetricCard
              label="Total Nodes"
              value={stats?.nodeCount || 0}
              bgColor={`bg-[${BRAND_COLORS.navy}]`}
              textColor="text-white"
              subtext="Knowledge graph entities"
            />
            <MetricCard
              label="Total Relationships"
              value={stats?.relationshipCount || 0}
              bgColor={`bg-[${BRAND_COLORS.orange}]`}
              textColor="text-white"
              subtext="Graph connections"
            />
            <MetricCard
              label="Unique Labels"
              value={Object.keys(stats?.labelCounts || {}).length}
              bgColor={`bg-[${BRAND_COLORS.steel}]`}
              textColor="text-white"
              subtext="Entity types"
            />
          </>
        )}
      </div>

      {/* Node Distribution by Label */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
        <h3 className="text-sm font-bold text-[#0C2833] mb-4">Node Distribution by Label</h3>
        {loading ? (
          <SkeletonLoader />
        ) : labelCountsArray.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={labelCountsArray}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill={BRAND_COLORS.orange} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#8CAEC1]">No data available</p>
        )}
      </div>

      {/* Relationship Types Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
          <h3 className="text-sm font-bold text-[#0C2833] mb-4">Relationship Types</h3>
          {loading ? (
            <SkeletonLoader />
          ) : relationshipCountsArray.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={relationshipCountsArray}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {relationshipCountsArray.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#8CAEC1]">No data available</p>
          )}
        </div>

        {/* Entity Legend */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
          <h3 className="text-sm font-bold text-[#0C2833] mb-4">Relationship Type Legend</h3>
          <div className="space-y-3">
            {loading ? (
              <SkeletonLoader />
            ) : relationshipCountsArray.length > 0 ? (
              relationshipCountsArray.map((rel, idx) => (
                <div key={rel.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0C2833]">{rel.name}</p>
                    <p className="text-xs text-[#8CAEC1]">{rel.value} connections</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#8CAEC1]">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Entity-Account Relationships */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
        <h3 className="text-sm font-bold text-[#0C2833] mb-4">Entities and Account Relationships</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <SkeletonLoader key={i} />
            ))}
          </div>
        ) : entities && entities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity, idx) => (
              <div key={idx} className="border border-[#DDE9EE] rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#0C2833]">{entity.entityName}</p>
                    <span className="text-xs bg-[#DDE9EE] text-[#0C2833] px-2 py-1 rounded mt-1 inline-block font-semibold">
                      {entity.entityCode}
                    </span>
                  </div>
                </div>
                <div className="my-3">
                  <p className="text-3xl font-bold text-[#FF5C00]">{entity.accountCount}</p>
                  <p className="text-xs text-[#8CAEC1]">accounts linked</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entity.accountTypes.slice(0, 3).map((type, typeIdx) => (
                    <span key={typeIdx} className="text-xs bg-[#F0F4F7] text-[#0C2833] px-2 py-1 rounded">
                      {type}
                    </span>
                  ))}
                  {entity.accountTypes.length > 3 && (
                    <span className="text-xs bg-[#F0F4F7] text-[#0C2833] px-2 py-1 rounded">
                      +{entity.accountTypes.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8CAEC1]">No entities found</p>
        )}
      </div>

      {/* Knowledge Graph Visualization */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
        <div className="flex items-center gap-3 mb-4">
          <Network className="h-5 w-5 text-[#FF5C00]" />
          <h3 className="text-sm font-bold text-[#0C2833]">Knowledge Graph Visualization</h3>
        </div>
        <p className="text-xs text-[#8CAEC1] mb-4">
          Interactive force-directed graph showing nodes (entities) and relationships. Nodes repel each other while edges pull connected nodes together.
        </p>
        {loading ? (
          <div className="h-96 bg-[#F0F4F7] rounded-lg animate-pulse" />
        ) : network && network.nodes.length > 0 ? (
          <ForceGraph nodes={network.nodes} edges={network.edges} />
        ) : (
          <p className="text-sm text-[#8CAEC1]">No network data available</p>
        )}
      </div>
    </div>
  );
}
