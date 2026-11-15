# Group 5 Project

# See Otters

A group scheduling app. Members of a group propose events, add the times they're free, and the server finds the times that work for everyone.

Stack: Node.js, TypeScript, Express, Kysely, Postgres.

This repository holds the backend API. The static pages in `src/client` are served by the same server at http://localhost:3000.

- Node.js 22, TypeScript (strict), Express 4
- PostgreSQL 17 in Docker
- Kysely for the query layer: it gives fully typed, parameterized queries and plain SQL migrations without the code generation step of Prisma or the schema DSL of Drizzle
- Zod for request validation, JWT access and refresh tokens, bcrypt password hashing
- Vitest and Supertest for tests, ESLint and Prettier

## Quick start with Docker

Requires Docker with Compose v2 and Node 22 (Node is only needed to seed the database and run tests from your machine).

```bash
# 1. Create your env file and fill in the blanks
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # run three times
#    paste one into JWT_SECRET, one into JWT_REFRESH_SECRET, one into POSTGRES_PASSWORD
#    then set the password inside DATABASE_URL to the same POSTGRES_PASSWORD

# 2. Start Postgres and the API (migrations run automatically on start)
docker compose up -d --build

# 3. Load sample data (optional)
npm install
npm run seed

# 4. Check it
curl http://localhost:3000/health
```

The API listens on `http://localhost:3000`. Sign in to the sample data with `you@example.com` and `password123`.

Stop with `docker compose down`. Add `-v` to also delete the database volume.

### Running the API on your machine instead

```bash
docker compose up -d db          # just Postgres
npm install
npm run migrate:up
npm run dev                      # or: npm start
```

## Environment variables

All configuration comes from the environment. Nothing secret is stored in the code, and the server refuses to start without the required values.

| Variable                 | Required     | Default                 | Purpose                                                                                    |
| ------------------------ | ------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| `JWT_SECRET`             | yes          | none                    | Signs access tokens (16 characters or more)                                                |
| `JWT_REFRESH_SECRET`     | yes          | none                    | Signs refresh tokens (16 characters or more)                                               |
| `DATABASE_URL`           | yes          | none                    | Postgres connection string used by the API, migrations and seed                            |
| `POSTGRES_PASSWORD`      | yes (Docker) | none                    | Password for the database container                                                        |
| `POSTGRES_USER`          | no           | `postgres`              | Database user                                                                              |
| `POSTGRES_DB`            | no           | `issue_tracker`         | Database name                                                                              |
| `DB_PORT`                | no           | `5432`                  | Host port for Postgres                                                                     |
| `PORT`                   | no           | `3000`                  | Host and API port                                                                          |
| `CORS_ORIGIN`            | no           | `http://localhost:5173` | The one browser origin allowed to call the API (your frontend URL)                         |
| `JWT_EXPIRES_IN`         | no           | `1h`                    | Access token lifetime                                                                      |
| `JWT_REFRESH_EXPIRES_IN` | no           | `7d`                    | Refresh token lifetime                                                                     |
| `RATE_LIMIT_WINDOW_MS`   | no           | `900000`                | Rate limit window                                                                          |
| `RATE_LIMIT_MAX`         | no           | `200`                   | Requests per window per IP on `/api` (credential routes use a quarter of this, minimum 10) |

Inside Docker the API gets `DATABASE_URL` from the compose file (host `db`), so the value in `.env` is only used when you run the API on your own machine.

## Migrations and seed data

```bash
npm run migrate:up     # apply pending migrations
npm run migrate:down   # roll back the most recent migration
npm run seed           # wipe all tables and load sample data
```

`npm run seed` deletes every row in every table, so it refuses to run when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=1` is set. The sample data mirrors the design: the five groups on the home page with the same member counts (Study Crew 6, Friday Pickup Soccer 14, Roommates 4, Book Club 9, Hack Night 11), the events shown on the group and home pages, the five notifications, and the signed-in user "You". Every sample account has the password `password123`.

Migrations live in `src/db/migrations`. Add a new file there and register it in `src/db/migrations/index.ts`.

## Schema

`001_initial_schema` is the team's original six-table schema. `002_huddle_schema` upgrades it in place: existing users are kept (`id` becomes `user_id`, a `name` is filled in from the email), and the unused scheduling tables are replaced with the tables the API needs (groups with roles, events with invitations, availability blocks, notifications, preferences, refresh tokens, group invites, support tickets and an email outbox). `npm run migrate:down` restores the original six tables. `docs/erd` still shows the original schema and has not been updated.

## Tests

```bash
npm test               # run the suite once
npm run test:watch     # watch mode
npm run format:check   # Prettier
npm run lint           # ESLint and type check
```

Tests run against an in-memory Postgres (pg-mem), so they need no database and no environment variables. Every endpoint is covered for success, validation failure, missing credentials and unauthorized access (for example, a non-member requesting a group). The overlap algorithm has its own unit tests.

## How events work

1. A group member creates an event with a name, a minimum duration, a minimum number of people (the creator counts) and a list of invitee emails.
2. Each invitee who has an account gets an in-app notification. Everyone else is emailed, and their invitation is attached to their account automatically when they sign up or log in with that email.
3. Each person (the creator included) posts the times they are free with `POST /api/events/{id}/availability`. Doing so also counts as a "yes".
4. After every change the server looks for a window where at least the minimum number of people are free together for at least the minimum duration. When one exists the event becomes **Confirmed** at the earliest such window, and the creator and every invitee who has not declined are notified once.
5. If a confirmed event later loses its window (for example, someone answers "no"), it returns to **Waiting for people** and participants are told.

Other rules:

- Only members can see a group and its events. An invitee who is not in the group can still open and answer the one event they were invited to.
- Any member can create events and invite people. Only an Admin can edit or delete a group, remove other members or change roles. The last Admin cannot leave.
- The minimum attendees cannot exceed the invited people plus the creator, because the event could never be confirmed.
- Group invitations must be accepted. People without an account are emailed.
- Availability times carry no time zone and are interpreted as UTC. Confirmed times come back as ISO 8601 UTC timestamps.
- Emails are queued in the `email_outbox` table. No mail is actually sent yet, so plug a delivery worker in there.
- Notification switches on the Account page suppress the matching in-app notifications. "Also send email" queues a copy of each notification.

## Project structure

```
src/
  app.ts                 Express app, CORS, rate limiting, route mounting
  config/env.ts          Validated environment configuration
  db/
    database.ts          Kysely instance
    types.ts             Table types
    migrations/          Schema migrations (index.ts registers them)
    migrator.ts          migrate:up and migrate:down
    seed.ts              Sample data
  middleware/            auth, authorize (group member and admin), validate, rate limiter, error handler
  modules/<name>/        routes -> controller -> service, plus Zod validation
    auth account home groups events notifications invites support mailer
  utils/                 jwt, password, formatting helpers
tests/                   Vitest and Supertest suites
docs/openapi.yaml        API reference
```

Each module keeps routing, controllers, services and validation in separate files. Authorization runs in middleware (`requireGroupMember`, `requireGroupAdmin`) and in the event service for routes that are not nested under a group.

## API reference

The full reference is in [docs/openapi.yaml](docs/openapi.yaml). Open it in Swagger Editor or any OpenAPI viewer.

Summary (all routes are under `/api` and need a bearer token unless noted):

| Area          | Endpoints                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (these four need no token), `GET /auth/me`                             |
| Account       | `GET` and `PUT /account/profile`, `GET` and `PUT /account/preferences`                                                                                      |
| Home          | `GET /home`                                                                                                                                                 |
| Groups        | `GET /groups`, `POST /groups`, `GET`, `PUT`, `DELETE /groups/{id}`, `POST /groups/{id}/invites`, `DELETE` and `PATCH /groups/{id}/members/{userId}`         |
| Group invites | `GET /group-invites`, `POST /group-invites/{id}/accept`, `POST /group-invites/{id}/decline`                                                                 |
| Events        | `GET` and `POST /groups/{groupId}/events`, `GET` and `DELETE /events/{id}`, `PUT /events/{id}/respond`, `GET` and `POST /events/{id}/availability`          |
| Notifications | `GET /notifications?filter=all\|invites\|updates`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `POST /notifications/mark-all-read` |
| Support       | `POST /support/contact` (token optional)                                                                                                                    |
| Health        | `GET /health` (outside `/api`)                                                                                                                              |

Request and response bodies use camelCase, matching the field names in the design (`membersLabel`, `pillBg`, `progress`, and so on). The profile endpoints return database column names (`avatar_color`). Every error looks like this:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "body.email", "message": "Invalid email address" }]
  }
}
```

## Sample requests

These use `jq` to pull values out of responses (optional, you can copy them by hand).

```bash
API=http://localhost:3000/api

# Sign in as a seeded user (or register: POST $API/auth/register with name, email, password)
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}' | jq -r .accessToken)

# Home page: groups, "Waiting on you", "Coming up", unread badge
curl -s $API/home -H "Authorization: Bearer $TOKEN"

# Create a group and invite people by email
GROUP=$(curl -s -X POST $API/groups -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Curl Crew","description":"Made from the README","color":"green","inviteEmails":["ava@example.com"]}' | jq .id)

# Create an event: 2 hours, needs 3 people (including you)
EVENT=$(curl -s -X POST $API/groups/$GROUP/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Saturday study session","minDurationMinutes":120,"minAttendees":3,
       "inviteEmails":["ava@example.com","newperson@example.com"]}' | jq .id)

# Share your free times (this also counts as a yes)
curl -s -X POST $API/events/$EVENT/availability -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"slots":[{"date":"2030-03-16","startTime":"10:00","endTime":"14:00"}]}'

# Group page and event details
curl -s $API/groups/$GROUP -H "Authorization: Bearer $TOKEN"
curl -s $API/events/$EVENT -H "Authorization: Bearer $TOKEN"

# Notifications
curl -s "$API/notifications?filter=invites" -H "Authorization: Bearer $TOKEN"
curl -s $API/notifications/unread-count -H "Authorization: Bearer $TOKEN"
curl -s -X POST $API/notifications/mark-all-read -H "Authorization: Bearer $TOKEN"

# Accept a group invitation (as the invited user)
curl -s $API/group-invites -H "Authorization: Bearer $OTHER_TOKEN"
curl -s -X POST $API/group-invites/1/accept -H "Authorization: Bearer $OTHER_TOKEN"
```

## Known limitations

- Email is queued, not sent.
- There is no password reset flow, because the design has no screen for it.
- The compose file now requires `POSTGRES_PASSWORD` in `.env` (see `.env.example`). Postgres only reads its credentials when the volume is first created, so an existing volume keeps its old password.
