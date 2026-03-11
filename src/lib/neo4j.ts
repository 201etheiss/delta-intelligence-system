import neo4j, { Driver, Session } from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI!;
const NEO4J_USER = process.env.NEO4J_USER!;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD!;

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  }
  return driver;
}

async function runQuery<T>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const d = getDriver();
  const session: Session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const obj: Record<string, unknown> = {};
      record.keys.forEach((key) => {
        const val = record.get(key);
        // Convert Neo4j integers to JS numbers
        if (neo4j.isInt(val)) {
          obj[key as string] = val.toNumber();
        } else if (val && typeof val === 'object' && val.properties) {
          // Node object — extract properties
          const props: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(val.properties)) {
            props[k] = neo4j.isInt(v) ? (v as { toNumber: () => number }).toNumber() : v;
          }
          props._labels = val.labels;
          obj[key as string] = props;
        } else {
          obj[key as string] = val;
        }
      });
      return obj as T;
    });
  } finally {
    await session.close();
  }
}

// ===== GRAPH OVERVIEW =====

export interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
  labelCounts: Record<string, number>;
  relationshipTypeCounts: Record<string, number>;
}

export async function getGraphStats(): Promise<GraphStats> {
  const [nodeResult] = await runQuery<{ count: number }>('MATCH (n) RETURN count(n) as count');
  const [relResult] = await runQuery<{ count: number }>('MATCH ()-[r]->() RETURN count(r) as count');

  const labelResults = await runQuery<{ label: string; count: number }>(
    'MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS count ORDER BY count DESC'
  );
  const relTypeResults = await runQuery<{ type: string; count: number }>(
    'MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count ORDER BY count DESC'
  );

  return {
    nodeCount: nodeResult?.count || 0,
    relationshipCount: relResult?.count || 0,
    labelCounts: Object.fromEntries(labelResults.map((r) => [r.label, r.count])),
    relationshipTypeCounts: Object.fromEntries(relTypeResults.map((r) => [r.type, r.count])),
  };
}

// ===== ENTITY-ACCOUNT RELATIONSHIPS =====

export interface EntityAccountRelation {
  entityName: string;
  entityCode: string;
  accountCount: number;
  accountTypes: string[];
}

export async function getEntityAccountRelations(): Promise<EntityAccountRelation[]> {
  return runQuery<EntityAccountRelation>(
    `MATCH (e:Entity)-[:HAS_ACCOUNT]->(a:Account)
     RETURN e.name AS entityName, e.code AS entityCode,
            count(a) AS accountCount,
            collect(DISTINCT a.account_type) AS accountTypes
     ORDER BY accountCount DESC`
  );
}

// ===== CLOSE TEMPLATE DEPENDENCIES =====

export interface CloseTemplateDep {
  templateName: string;
  category: string;
  dependsOn: string[];
  dependencyCount: number;
}

export async function getCloseTemplateDependencies(): Promise<CloseTemplateDep[]> {
  return runQuery<CloseTemplateDep>(
    `MATCH (ct:CloseTemplate)
     OPTIONAL MATCH (ct)-[:DEPENDS_ON]->(dep:CloseTemplate)
     RETURN ct.name AS templateName, ct.category AS category,
            collect(dep.name) AS dependsOn, count(dep) AS dependencyCount
     ORDER BY dependencyCount DESC`
  );
}

// ===== GRAPH NETWORK DATA (for D3/force-graph visualization) =====

export interface GraphNode {
  id: string;
  label: string;
  name: string;
  group: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphNetwork {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function getGraphNetwork(limit: number = 150): Promise<GraphNetwork> {
  // Get nodes with their labels
  const nodeResults = await runQuery<{
    id: string;
    labels: string[];
    name: string;
  }>(
    `MATCH (n)
     WHERE n.name IS NOT NULL OR n.account_number IS NOT NULL
     RETURN elementId(n) AS id, labels(n) AS labels,
            COALESCE(n.name, n.account_number, 'Unknown') AS name
     LIMIT $limit`,
    { limit: neo4j.int(limit) }
  );

  // Get relationships
  const edgeResults = await runQuery<{
    source: string;
    target: string;
    type: string;
  }>(
    `MATCH (a)-[r]->(b)
     RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS type
     LIMIT $limit`,
    { limit: neo4j.int(limit * 2) }
  );

  const nodes: GraphNode[] = nodeResults.map((n) => ({
    id: n.id,
    label: Array.isArray(n.labels) ? n.labels[0] || 'Node' : 'Node',
    name: n.name,
    group: Array.isArray(n.labels) ? n.labels[0] || 'Other' : 'Other',
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = edgeResults.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  return { nodes, edges };
}

// ===== ACCOUNT HIERARCHY =====

export interface AccountHierarchy {
  entityName: string;
  entityType: string;
  accounts: {
    name: string;
    type: string;
    number: string;
  }[];
}

export async function getAccountHierarchy(): Promise<AccountHierarchy[]> {
  const results = await runQuery<{
    entityName: string;
    entityType: string;
    accName: string;
    accType: string;
    accNumber: string;
  }>(
    `MATCH (e:Entity)-[:HAS_ACCOUNT]->(a:Account)
     RETURN e.name AS entityName, e.entity_type AS entityType,
            a.name AS accName, a.account_type AS accType,
            a.account_number AS accNumber
     ORDER BY e.name, a.account_type, a.name`
  );

  const hierarchy: Record<string, AccountHierarchy> = {};
  for (const row of results) {
    if (!hierarchy[row.entityName]) {
      hierarchy[row.entityName] = {
        entityName: row.entityName,
        entityType: row.entityType || 'unknown',
        accounts: [],
      };
    }
    hierarchy[row.entityName].accounts.push({
      name: row.accName,
      type: row.accType || 'unknown',
      number: row.accNumber || '',
    });
  }

  return Object.values(hierarchy);
}

// ===== PROFIT CENTER RELATIONSHIPS =====

export async function getProfitCenterRelations() {
  return runQuery<{
    profitCenter: string;
    entityName: string;
    projectCount: number;
  }>(
    `MATCH (pc:ProfitCenter)-[:BELONGS_TO]->(e:Entity)
     OPTIONAL MATCH (p:Project)-[:ASSIGNED_TO]->(pc)
     RETURN pc.name AS profitCenter, e.name AS entityName,
            count(p) AS projectCount
     ORDER BY projectCount DESC`
  );
}

export default { getDriver, runQuery };
