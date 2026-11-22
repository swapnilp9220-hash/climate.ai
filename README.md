# ResilioAI Core

ResilioAI Core extends the existing Next.js 16 / React 19 app. The new intelligence dashboard is at `/ai-agent`; the original workspace page remains available at `/workspace`. The existing `/api/agent` endpoint now delegates to the same live orchestrator as `/api/chat`.

## Local setup

Use Node.js 22.18 or newer and PostgreSQL. From `app/`:

1. Copy `.env.example` to `.env` and fill in the required server-side values.
2. Run `npm install`.
3. Generate the Prisma client with `npx prisma generate`.
4. Apply the initial database migration with `npx prisma migrate deploy`.
5. Run `npm run dev` and open `http://localhost:3000/ai-agent`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes for AI chat | Server-only API key for LLM responses and function calling. |
| `OPENAI_MODEL` | No | Model identifier; defaults to `gpt-4o-mini`. |
| `DATABASE_URL` | Yes for saved chats | PostgreSQL connection string. |
| `RESILIO_ADMIN_PASSWORD` | Yes in production | Single workspace-owner sign-in password. |
| `RESILIO_SESSION_SECRET` | Yes in production | Random secret used to sign seven-day session cookies. |
| `AGMARKNET_API_KEY` | No | data.gov.in API key; without it mandi records are reported unavailable. |

Generate a session key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep all keys on the server. Do not use `NEXT_PUBLIC_*` for secrets.

## Connected data and limitations

- **Weather and climate:** Open-Meteo geocoding and 7-day forecast. The drought label is a documented short-term screen based on seven-day rainfall and high temperatures, not an official seasonal drought index.
- **Soil and agriculture:** ISRIC SoilGrids returns gridded soil pH, organic carbon, and clay data. Crop suitability is a summary of retrieved inputs, not a calibrated agronomic prescription. Mandi prices require the optional government API key.
- **Resource management:** Water, solar, and demand tools return unavailable until a meter, inverter, traffic, or module data source is connected. They never report measured consumption or exact savings without a baseline.
- Tool results carry source, timestamp, units where known, data class, and availability. Tool calls and agent activity are logged without storing tool arguments.

The pre-existing `/workspace` UI and `/api/agent` contract are retained. The Core dashboard and API do not use the old demo tool results; its tools call live providers or return an explicit unavailable result.

## Database and security

The initial PostgreSQL schema and migration live in `app/prisma/`. It stores conversations, messages, agent/tool logs, user preferences, source status, reports, and notifications. Conversation deletion cascades to messages. Production access uses an HTTP-only, signed session cookie and a single workspace-owner account; local development without the owner password configured uses a local-only bypass. This is a single-owner deployment, not multi-tenant identity.

The route-level in-memory rate limiter is only a small-instance guard. Use a shared rate-limit store before public or high-volume deployment. There are no IoT control/write operations.

## Vercel deployment

Import the repository and set Vercel's project root to `app`. Configure the environment variables for the deployment environment and attach PostgreSQL. Run `npx prisma migrate deploy` as a release step before enabling chat. `app/vercel.json` selects the Mumbai region and API function duration. `/api/health` checks the configured model, database, weather endpoint, and SoilGrids endpoint and reports `online`, `degraded`, or `offline`.

## Source references

- [Open-Meteo API documentation](https://open-meteo.com/en/docs)
- [ISRIC SoilGrids REST API](https://rest.isric.org/soilgrids/v2.0/docs)
- [Government of India daily mandi price dataset](https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi)
