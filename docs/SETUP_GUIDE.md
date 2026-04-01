# Delta Intelligence — Full Setup Guide

## Azure AD App Permissions (Required)

App Registration: `5e67b1da-9335-477b-a760-ed12d57bd17c`
Tenant: `38425e73-18b7-4732-a2b9-052a686205b7` (Delta360)

### Step 1: Add API Permissions

Go to Azure Portal > App Registrations > 5e67b1da > API Permissions > Add Permission > Microsoft Graph

**Delegated Permissions (for user-context actions):**

| Permission | Purpose | Status |
|------------|---------|--------|
| `User.Read` | Basic sign-in | Already granted |
| `Calendars.ReadWrite` | Create/edit calendar events + Teams meetings | NEEDED |
| `OnlineMeetings.ReadWrite` | Generate Teams meeting join links | NEEDED |
| `Mail.Send` | Send emails from the app | NEEDED |
| `Mail.ReadWrite` | Read/draft emails | NEEDED |
| `Files.ReadWrite.All` | Upload/move SharePoint files | NEEDED |
| `Sites.ReadWrite.All` | SharePoint site access | Already have Sites.Read |
| `Chat.ReadWrite` | Post to Teams channels | NEEDED |
| `People.Read` | Look up contacts by name | NEEDED |
| `Contacts.Read` | Access Outlook contacts | NEEDED |

**Application Permissions (for background/automation actions):**

| Permission | Purpose | Status |
|------------|---------|--------|
| `Calendars.ReadWrite` | Create events on behalf of users | NEEDED |
| `Mail.Send` | Send automated emails | NEEDED |
| `Reports.Read.All` | Power BI report access | NEEDED (fixes PBI datasets/reports) |

### Step 2: Grant Admin Consent

After adding permissions, click "Grant admin consent for Delta360" button.

### Step 3: Add Redirect URI

Authentication > Web > Add URI:
```
http://localhost:3004/api/auth/callback/azure-ad
```

For production, also add:
```
https://intelligence.delta360.energy/api/auth/callback/azure-ad
```

---

## Integration API Keys Needed

Configure in Admin > Integrations (`/admin/integrations`):

| Integration | Required Credentials | Where to Get |
|-------------|---------------------|-------------|
| **Resend** (email) | API Key | resend.com/api-keys |
| **Twilio** (SMS) | Account SID, Auth Token, From Number | twilio.com/console |
| **Slack** | Webhook URL | api.slack.com/messaging/webhooks |
| **Teams** | Incoming Webhook URL | Teams channel > Connectors > Incoming Webhook |
| **n8n** | Webhook URL (your n8n instance) | Your n8n workflow webhook trigger URL |
| **Zapier** | Webhook URL | zapier.com/app/zaps (Webhooks by Zapier trigger) |
| **Samsara** | Webhook Secret | samsara.com > Settings > Webhooks |

---

## Employee Directory (from Salesforce + M365)

### Salesforce Active Users (71)

Key personnel for role mapping:

| Name | Email | SF Profile | DI Role |
|------|-------|------------|---------|
| Adam Vegas | avegas@delta360.energy | System Administrator | admin |
| Evan Theiss | etheiss@delta360.energy | — | admin |
| Courtney Maples | comaples@delta360.energy | System Administrator | admin |
| Anna Snodgrass | asnodgrass@delta360.energy | Oil & Gas | sales |
| Ashlee Hey | ahey@delta360.energy | Oil & Gas | sales |
| Ashley Hadwin | ahadwin@delta360.energy | Commercial | sales |
| Barry Iseminger | biseminger@delta360.energy | Commercial | sales |
| Brandon Thornton | bthornton@delta360.energy | Commercial | sales |
| Brian McCaskill | bmccaskill@delta360.energy | Commercial | sales |
| Abby Marks | amarks@delta360.energy | Service Supervisor | operations |
| Dana Barron | dbarron@delta360.energy | Service Supervisor | operations |
| Barbara Lasseigne | blasseigne@delta360.energy | Standard User | readonly |
| Adriana Hernandez | ahernandez@delta360.energy | Oil & Gas | sales |
| Alexis Deaton | adeaton@delta360.energy | Commercial | sales |
| Carson Greer | cgreer@delta360.energy | Commercial | sales |
| Chad Sheppard | csheppard@delta360.energy | Commercial | sales |
| Cody McLelland | cmclelland@delta360.energy | Commercial | sales |
| Brian Pourciaux | bpourciaux@delta360.energy | Industrial | operations |
| Bubba Strack | bstrack@delta360.energy | Commercial | sales |

### Microsoft 365 (412 users)

412 accounts in the M365 tenant. Domain: `@delta360.energy` (primary), `@deltafuel.com` (legacy).

### Samsara Drivers (237 active)

237 active drivers in Samsara fleet management.

---

## Role Assignment Matrix

| SF Profile | Delta Intelligence Role | Access |
|------------|------------------------|--------|
| System Administrator | admin | All 8 sources + admin portal |
| Service Supervisor | operations | Ascend + Samsara + Fleet Panda |
| Oil & Gas - Minimum Access | sales | Salesforce + Power BI |
| Commercial - Minimum Access | sales | Salesforce + Power BI |
| Industrial - Minimum Access | operations | Ascend + Samsara + Fleet Panda |
| Standard User | readonly | All sources, read-only |
| B2BMA Integration User | — | Skip (system account) |
| IT- Minimum Access | admin | All sources |

---

## Environment Variables (.env.local)

```env
# Auth (Azure AD)
AZURE_AD_CLIENT_ID=5e67b1da-9335-477b-a760-ed12d57bd17c
AZURE_AD_CLIENT_SECRET=<from Azure portal>
AZURE_AD_TENANT_ID=38425e73-18b7-4732-a2b9-052a686205b7
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3004

# AI Models
ANTHROPIC_API_KEY=<your key>
OPENAI_API_KEY=<optional>
GOOGLE_AI_API_KEY=<optional>

# Gateway
GATEWAY_BASE_URL=http://127.0.0.1:3847
GATEWAY_ADMIN_KEY=<admin key>
GATEWAY_ACCTG_KEY=<accounting key>
GATEWAY_SALES_KEY=<sales key>
GATEWAY_OPS_KEY=<operations key>
GATEWAY_READONLY_KEY=<readonly key>

# Integrations (configure via Admin > Integrations)
RESEND_API_KEY=<optional>
TWILIO_ACCOUNT_SID=<optional>
TWILIO_AUTH_TOKEN=<optional>
TWILIO_FROM_NUMBER=<optional>
```

---

## Startup Commands

```bash
# 1. Start the gateway
cd ~/.claude/mcp-servers/ascend-sql && node gateway.cjs

# 2. Start the app
cd ~/delta360/intelligence && ANTHROPIC_API_KEY=<key> npx next dev -p 3004

# 3. Re-auth Samsara (if needed)
open http://localhost:3847/samsara/auth

# 4. Start cron scheduler (optional — via admin API)
curl -X POST http://localhost:3004/api/scheduler

# 5. Run schema crawl (indexes products + locations)
curl -X POST http://localhost:3004/api/registry/crawl
```
