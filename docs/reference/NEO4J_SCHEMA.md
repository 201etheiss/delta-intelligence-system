# Delta Intelligence System — Neo4j Graph Schema

**Last Updated:** 2026-03-31

All 13 node types and 23+ relationship types with properties. The graph captures what flat tables cannot: chains of causation, dependency networks, entity hierarchies, and hidden patterns.

---

## Connection

- **URI:** neo4j+s://2b6eeb9d.databases.neo4j.io
- **Username:** 2b6eeb9d
- **Instance:** "Controller Co-Pilot"

---

## Node Types (13)

### 1. Person
```cypher
CREATE (p:Person {
    id: "taylor-veazey",
    name: "Taylor Veazey",
    title: "Corporate Controller",
    department: "Finance",
    role: "controller",          -- Maps to Delta Intelligence role
    email: "tveazey@delta360.com",
    start_date: date("2025-11-17"),
    is_active: true
})
```
**Count:** 17 people mapped (see SKILL.md for full list)

### 2. Entity
```cypher
CREATE (e:Entity {
    id: "delta-fuel-co",
    name: "Delta Fuel Company, LLC",
    brand: "Delta360",
    type: "operating_company",   -- operating_company, division, subsidiary
    address: "521 Main Street, Natchez, MS 39120",
    ein: "XX-XXXXXXX"
})
```

### 3. Account
```cypher
CREATE (a:Account {
    id: "10345",
    standard_acct_no: "10345",
    name: "Broker-FC Stone",
    account_type: "Asset",
    normal_balance: "Debit",
    fs_line: "BS",
    fs_subgroup: "Current Assets",
    is_key_account: true         -- Flagged for special tracking
})
```
**Count:** 71 accounts tracked. Key accounts: 10345 (Broker-FC Stone), 68115 (StoneX Commission), 80200 (Hedging Gain/Loss), 22630 (HSA Liability), 17200 (Vehicles), 12000 (AR Control), 20000 (AP Trade), 25100 (JPM LOC), 17800 (CIP)

### 4. Department
```cypher
CREATE (d:Department {
    id: "finance",
    name: "Finance & Accounting",
    cost_center_code: "FIN",
    entity_id: "delta-fuel-co"
})
```

### 5. System
```cypher
CREATE (s:System {
    id: "ascend",
    name: "PDI Ascend",
    type: "ERP",
    status: "active",            -- active, legacy, evaluation
    vendor: "PDI Software",
    data_types: ["GL", "AP", "AR", "Inventory", "Fuel Pricing"],
    integration_method: "sql_server"
})
```
**Count:** 10 systems: Ascend, Vroozi, Paylocity, BizInsight, Solver (legacy), NetSuite (eval), Avalara (eval), Salesforce, Gravitate, Delta Intelligence

### 6. Workstream
```cypher
CREATE (w:Workstream {
    id: "close-management",
    name: "Close Management",
    owner: "taylor-veazey",
    priority: "P0",
    status: "active",
    description: "Month-end close process — Day 5 target"
})
```
**Count:** 10 workstreams: Finance/Accounting, Audit/Lender Compliance, Systems Transformation, AI Strategy, Operational Workflows, Margin Analytics, CFO/Controller Decision Support, AP Automation Pilot, Close Management, Treasury/Borrowing Base

### 7. Module
```cypher
CREATE (m:Module {
    id: "close-readiness",
    name: "Close Readiness",
    workstream: "close-management",
    phase: 2,
    status: "designed",          -- built, designed, planned
    description: "Real-time close readiness assessment"
})
```
**Count:** 20 Phase 2 modules

### 8. JEFamily
```cypher
CREATE (f:JEFamily {
    id: "depreciation",
    name: "Depreciation",
    frequency: "monthly",
    source_system: "ascend",
    template_count: 3,
    is_automated: false,
    automation_readiness: 0.6    -- 0-1 scale
})
```
**Count:** 12 JE families

### 9. JETemplate
```cypher
CREATE (t:JETemplate {
    id: "depr-vehicles",
    name: "Vehicle Depreciation",
    family: "depreciation",
    accounts: ["17200", "68100"],
    calc_method: "straight_line",
    source_data: "fap_export",
    status: "placeholder"        -- placeholder, hardened, production
})
```
**Count:** 43 templates

### 10. Control
```cypher
CREATE (c:Control {
    id: "day5-close",
    name: "Day-5 Close Target",
    type: "process",
    metric: "close_day",
    target_value: 5,
    threshold: "<=",
    current_value: null,         -- Updated each close
    status: "not_measured"
})
```
**Count:** 12 controls/metrics

### 11. SourceFile
```cypher
CREATE (sf:SourceFile {
    id: "ascend-gl-202603",
    source_system: "ascend",
    file_type: "gl_transactions",
    period: "2026-03",
    row_count: 15000,
    imported_at: datetime(),
    status: "imported"
})
```

### 12. ReconRule
```cypher
CREATE (r:ReconRule {
    id: "bank-recon-jpm",
    name: "JPM Bank Reconciliation",
    account: "10100",
    source_a: "ascend_gl",
    source_b: "bank_statement",
    tolerance: 1.00,
    frequency: "monthly"
})
```
**Count:** 37 reconciliation rules

### 13. Vehicle
```cypher
CREATE (v:Vehicle {
    id: "bf-186",
    samsara_id: "281474985529450",
    ascend_equipment_id: null,    -- Needs crosswalk
    name: "BF-186",
    vin: "1FVHBXAK43HL92724",
    make: "FREIGHTLINER",
    model: "FL80",
    year: 2003,
    license_plate: "P236639",
    status: "active"
})
```
**Count:** 178 vehicles from Samsara

---

## Relationship Types (23+)

### Organizational Relationships

```cypher
// Person → Entity: Employment
(p:Person)-[:WORKS_FOR {since: date("2025-11-17"), role: "Corporate Controller"}]->(e:Entity)

// Person → Person: Reporting line
(p1:Person)-[:REPORTS_TO]->(p2:Person)

// Person → Department: Assignment
(p:Person)-[:MEMBER_OF]->(d:Department)

// Department → Entity: Belongs to
(d:Department)-[:BELONGS_TO]->(e:Entity)

// Person → Workstream: Ownership
(p:Person)-[:OWNS]->(w:Workstream)

// Person → Module: Responsible for
(p:Person)-[:RESPONSIBLE_FOR]->(m:Module)
```

### System Relationships

```cypher
// System → Entity: Used by
(s:System)-[:USED_BY]->(e:Entity)

// System → System: Feeds data to
(s1:System)-[:FEEDS {data_types: ["GL", "AP"], method: "csv_export", frequency: "daily"}]->(s2:System)

// System → Module: Powers
(s:System)-[:POWERS]->(m:Module)

// SourceFile → System: Originated from
(sf:SourceFile)-[:ORIGINATED_FROM]->(s:System)
```

### Financial Relationships

```cypher
// Account → Account: Parent hierarchy
(a1:Account)-[:CHILD_OF]->(a2:Account)

// Account → Account: Contra account
(a1:Account)-[:CONTRA_TO]->(a2:Account)

// Account → Entity: Belongs to
(a:Account)-[:BELONGS_TO]->(e:Entity)

// JETemplate → JEFamily: Member of
(t:JETemplate)-[:MEMBER_OF]->(f:JEFamily)

// JETemplate → Account: Debits/Credits
(t:JETemplate)-[:DEBITS {formula: "SUM(gross_pay)"}]->(a:Account)
(t:JETemplate)-[:CREDITS {formula: "SUM(net_pay)"}]->(a:Account)

// JEFamily → System: Sources data from
(f:JEFamily)-[:SOURCES_FROM]->(s:System)

// ReconRule → Account: Reconciles
(r:ReconRule)-[:RECONCILES]->(a:Account)
```

### Close Dependencies

```cypher
// CloseTask → CloseTask: Depends on (DAG)
(t1:CloseTemplate)-[:DEPENDS_ON]->(t2:CloseTemplate)

// CloseTask → JEFamily: Requires completion
(t:CloseTemplate)-[:REQUIRES]->(f:JEFamily)

// CloseTask → ReconRule: Requires completion
(t:CloseTemplate)-[:REQUIRES]->(r:ReconRule)

// CloseTask → Person: Assigned to
(t:CloseTemplate)-[:ASSIGNED_TO]->(p:Person)
```

### Workstream → Module hierarchy

```cypher
// Module → Workstream: Part of
(m:Module)-[:PART_OF]->(w:Workstream)

// Module → Module: Depends on
(m1:Module)-[:DEPENDS_ON]->(m2:Module)
```

### Fleet Relationships

```cypher
// Vehicle → Entity: Owned by
(v:Vehicle)-[:OWNED_BY]->(e:Entity)

// Vehicle → Account: GL tracked in
(v:Vehicle)-[:GL_ACCOUNT]->(a:Account)

// Vehicle → Department: Assigned to
(v:Vehicle)-[:ASSIGNED_TO]->(d:Department)
```

---

## Key Graph Queries

### 1. Close dependency chain — what's blocking Day 5?
```cypher
MATCH path = (t:CloseTemplate)-[:DEPENDS_ON*]->(blocker:CloseTemplate)
WHERE blocker.status <> 'completed' AND t.day_target <= 5
RETURN path
```

### 2. Account relationship chain — follow the money
```cypher
MATCH path = (a:Account {standard_acct_no: "10345"})-[*1..3]-(related)
RETURN path
```

### 3. Who owns what — organizational coverage
```cypher
MATCH (p:Person)-[:OWNS|RESPONSIBLE_FOR]->(target)
RETURN p.name, collect(target.name) AS responsibilities
ORDER BY p.name
```

### 4. System dependency map — what breaks if Ascend goes down?
```cypher
MATCH path = (s:System {name: "PDI Ascend"})<-[:SOURCES_FROM|FEEDS*1..3]-(dependent)
RETURN path
```

### 5. JE template completeness — which families are production-ready?
```cypher
MATCH (f:JEFamily)<-[:MEMBER_OF]-(t:JETemplate)
RETURN f.name,
       COUNT(t) AS total_templates,
       COUNT(CASE WHEN t.status = 'production' THEN 1 END) AS production,
       COUNT(CASE WHEN t.status = 'placeholder' THEN 1 END) AS placeholder
ORDER BY placeholder DESC
```

### 6. Fleet → GL mapping — vehicles without GL accounts
```cypher
MATCH (v:Vehicle)
WHERE NOT (v)-[:GL_ACCOUNT]->(:Account)
RETURN v.name, v.vin, v.samsara_id
```
