# Delta Intelligence

Enterprise AI-powered intelligence platform for Delta360. Full ERP replacement system with 20 accounting engines, 8 data service integrations, 86 plugins, and agentic AI automation.

## Architecture

- **Framework**: Next.js 14 App Router
- **Auth**: Microsoft SSO (Azure AD) with 6 roles
- **Data**: 8 gateway services (Ascend ERP, Salesforce, Samsara, Vroozi, MS 365, Power BI, Paylocity, Fleet Panda)
- **AI**: Multi-model agentic loop with 9 tools, anomaly detection, smart suggestions, pattern discovery
- **Engines**: 20 accounting engines (JE, Close, Recon, Cash Flow, GL, Financial Statements, AP, AR, Fixed Assets, Inventory, Tax, Evidence Vault, Audit, Budgets, Expenses, Contracts, Commentary, Data Bridge, Intelligence Brief, Order to Cash)

## Platform Stats

- 61+ dashboard pages
- 104+ API routes
- 20 accounting engines
- 86 plugins (10 categories)
- 8 data services (128 gateway endpoints)
- 37 users mapped with role-based access
- 11 widget types for visualization
- 10 workstreams covering full business operations

## Quick Start

```bash
npm install
cp .env.example .env.local
# Configure Azure AD, gateway, and service credentials
npm run dev
```

Dev server: http://localhost:3004
Gateway: http://localhost:3847

## Documentation

See [docs/](./docs/) for full documentation:
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture
- [API_REFERENCE.md](./docs/API_REFERENCE.md) — API endpoint reference
- [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) — Database schema (24 Supabase tables)
- [INTEGRATION_ROADMAP.md](./docs/INTEGRATION_ROADMAP.md) — Integration plan
- [FULL_BUILDOUT_SCHEMA.md](./docs/FULL_BUILDOUT_SCHEMA.md) — 35-module ERP replacement plan
- [GATEWAY_REFERENCE.md](./docs/GATEWAY_REFERENCE.md) — Gateway service reference
- [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) — Setup instructions

## Key People

- **Taylor Veazey** — Corporate Controller 
- **Adam Vegas** — President/CEO
- **Evan Theiss** — Head of Special Projects - AI Strategy/System Builder

## License

Proprietary — Delta360
