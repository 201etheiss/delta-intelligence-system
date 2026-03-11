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

const BRAND = {
  orange: '#FF5C00',
  navy: '#0C2833',
  steel: '#8CAEC1',
  white: '#FFFFFF',
  orangeLight: '#FF8A40',
  steelPale: '#DDE9EE',
  steelDark: '#B5CFD9',
  navyLight: '#122F3D',
  bg: '#F7F9FB',
};

const NODE_COLORS: Record<string, string> = {
  'Entity': BRAND.orange,
  'Account': BRAND.navy,
  'CloseTemplate': BRAND.steel,
  'JournalTemplate': BRAND.orangeLight,
  'ReconRule': BRAND.steelDark,
  'default': BRAND.steelPale,
};

const PIE_COLORS = [BRAND.orange, BRAND.navy, BRAND.steel, BRAND.orangeLight, BRAND.steelDark, BRAND.navyLight];

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 bg-[#DDE9EE] rounded w-3/4"></div>
      <div className="h-4 bg-[#DDE9EE] rounded w-1/2"></div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0C2833] text-white rounded-lg px-4 py-2.5 text-sm shadow-elevated border border-[#122F3D]">
        <p className="text-[10px] uppercase tracking-wider text-[#8CAEC1] mb-0.5">{payload[0].payload?.name || payload[0].name}</p>
        <p className="font-bold text-base">{payload[0].value}</p>
      </div>
    );
  }
  return null;
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
    const K = 50;
    const REPULSION = 5000;
    const DAMPING = 0.85;
    const CENTER_STRENGTH = 0.01;
    const ITERATIONS = 200;

    let iteration = 0;

    const simulate = () => {
      if (iteration >= ITERATIONS) return;
      iteration++;

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

        if (pos.x < 30) forces[node.id].x += 5;
        if (pos.x > canvas.width - 30) forces[node.id].x -= 5;
        if (pos.y < 30) forces[node.id].y += 5;
        if (pos.y > canvas.height - 30) forces[node.id].y -= 5;
      });

      // Update velocities and positions
      nodes.forEach((node) => {
        const vel = velocities[node.id];
        vel.x = (vel.x + forces[node.id].x) * DAMPING;
        vel.y = (vel.y + forces[node.id].y) * DAMPING;

        const pos = positions[node.id];
        pos.x += vel.x;
        pos.y += vel.y;

        pos.x = Math.max(30, Math.min(canvas.width - 30, pos.x));
        pos.y = Math.max(30, Math.min(canvas.height - 30, pos.y));
      });

      // Render — brand background
      ctx.fillStyle = BRAND.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw edges with brand steel color
      edges.forEach((edge) => {
        const pos1 = positions[edge.source];
        const pos2 = positions[edge.target];

        if (pos1 && pos2) {
          ctx.strokeStyle = BRAND.steelPale;
          ctx.lineWidth = 1;
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

        // Outer glow
        ctx.fillStyle = nodeColor + '20';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Node border
        ctx.strokeStyle = BRAND.white;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        ctx.fillStyle = BRAND.navy;
        ctx.font = 'bold 9px Inter, sans-serif';
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
      className="w-full rounded-xl"
      style={{ height: '500px', background: BRAND.bg }}
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

  // Metric card data with explicit static classes (Tailwind can't resolve dynamic bg-[] )
  const metricCards = [
    {
      label: 'Total Nodes',
      value: stats?.nodeCount || 0,
      subtext: 'Knowledge graph entities',
      bgClass: 'metric-card-navy',
    },
    {
      label: 'Total Relationships',
      value: stats?.relationshipCount || 0,
      subtext: 'Graph connections',
      bgClass: 'metric-card-orange',
    },
    {
      label: 'Unique Labels',
      value: Object.keys(stats?.labelCounts || {}).length,
      subtext: 'Entity types',
      bgClass: 'metric-card-steel',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">System Insights</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Real-time knowledge graph analytics and entity relationships</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Graph Statistics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading ? (
          <>
            <div className="bg-white rounded-xl border border-[#DDE9EE] p-6"><SkeletonLoader /></div>
            <div className="bg-white rounded-xl border border-[#DDE9EE] p-6"><SkeletonLoader /></div>
            <div className="bg-white rounded-xl border border-[#DDE9EE] p-6"><SkeletonLoader /></div>
          </>
        ) : (
          metricCards.map((card) => (
            <div key={card.label} className={`${card.bgClass} rounded-xl p-6 text-white shadow-card`}>
              <p className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-2 opacity-80">{card.label}</p>
              <p className="text-4xl font-extrabold mb-1 tracking-tight">{card.value}</p>
              <p className="text-xs opacity-60">{card.subtext}</p>
            </div>
          ))
        )}
      </div>

      {/* Node Distribution by Label */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
        <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Node Distribution by Label</h3>
        <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
        {loading ? (
          <SkeletonLoader />
        ) : labelCountsArray.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={labelCountsArray}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8CAEC1' }} axisLine={{ stroke: '#DDE9EE' }} tickLine={false} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12, fill: '#0C2833', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={BRAND.orange} radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#8CAEC1]">No data available</p>
        )}
      </div>

      {/* Relationship Types Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Relationship Types</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
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
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#F7F9FB"
                >
                  {relationshipCountsArray.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#8CAEC1]">No data available</p>
          )}
        </div>

        {/* Relationship Legend */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Relationship Type Legend</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
          <div className="space-y-3.5">
            {loading ? (
              <SkeletonLoader />
            ) : relationshipCountsArray.length > 0 ? (
              relationshipCountsArray.map((rel, idx) => (
                <div key={rel.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  ></div>
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-sm font-medium text-[#0C2833]">{rel.name}</p>
                    <p className="text-xs font-semibold text-[#8CAEC1] bg-[#F0F4F7] px-2.5 py-0.5 rounded-full">{rel.value}</p>
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
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
        <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Entities and Account Relationships</h3>
        <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#F7F9FB] rounded-lg p-5"><SkeletonLoader /></div>
            ))}
          </div>
        ) : entities && entities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity, idx) => (
              <div key={idx} className="border border-[#DDE9EE] rounded-xl p-5 hover:shadow-card-hover transition-all duration-200 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#0C2833]">{entity.entityName}</p>
                    <span className="text-[10px] uppercase tracking-wider bg-[#DDE9EE] text-[#0C2833] px-2 py-0.5 rounded mt-1.5 inline-block font-semibold">
                      {entity.entityCode}
                    </span>
                  </div>
                </div>
                <div className="my-3">
                  <p className="text-3xl font-extrabold text-[#FF5C00] tracking-tight">{entity.accountCount}</p>
                  <p className="text-[11px] text-[#8CAEC1] font-medium mt-0.5">accounts linked</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#F0F4F6]">
                  {entity.accountTypes.slice(0, 3).map((type, typeIdx) => (
                    <span key={typeIdx} className="text-[10px] bg-[#F0F4F7] text-[#0C2833] px-2 py-0.5 rounded font-medium">
                      {type}
                    </span>
                  ))}
                  {entity.accountTypes.length > 3 && (
                    <span className="text-[10px] bg-[rgba(255,92,0,0.08)] text-[#FF5C00] px-2 py-0.5 rounded font-semibold">
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
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
        <div className="flex items-center gap-3 mb-1.5">
          <Network className="h-5 w-5 text-[#FF5C00]" />
          <h3 className="text-sm font-bold text-[#0C2833]">Knowledge Graph Visualization</h3>
        </div>
        <div className="w-8 h-[2px] bg-[#FF5C00] mb-4 rounded-full ml-8"></div>
        <p className="text-xs text-[#8CAEC1] mb-4">
          Force-directed graph showing nodes and relationships. Nodes repel each other while edges pull connected nodes together.
        </p>
        {/* Node Color Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(NODE_COLORS).filter(([k]) => k !== 'default').map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="text-[11px] font-medium text-[#0C2833]">{label}</span>
            </div>
          ))}
        </div>
        {loading ? (
          <div className="h-[500px] bg-[#F7F9FB] rounded-xl animate-pulse" />
        ) : network && network.nodes.length > 0 ? (
          <ForceGraph nodes={network.nodes} edges={network.edges} />
        ) : (
          <p className="text-sm text-[#8CAEC1]">No network data available</p>
        )}
      </div>
    </div>
  );
}
