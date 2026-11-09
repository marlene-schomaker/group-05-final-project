# Group 5 Project

## Database setup

1. Copy the env file: `cp .env.example .env`
2. Start Postgres: `docker compose up -d`
3. Run migrations: `npm run migrate:up`
4. Undo the last migration: `npm run migrate:down`

The schema is documented in `docs/erd.pdf`.
