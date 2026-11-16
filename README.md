# Group 5 Project

# See Otters

A group scheduling app. Members of a group propose events, add the times they're free, and the server finds the times that work for everyone.

Stack: Node.js, TypeScript, Express, Kysely, Postgres.

## Database setup

1. Copy the env file: `cp .env.example .env`
2. Start Postgres: `docker compose up -d`
3. Run migrations: `npm run migrate:up`
4. Undo the last migration: `npm run migrate:down`

The schema is documented in `docs/erd.pdf`.

## Frontend Setup

### 1. Clone, Install, and Configure
```bash
git clone <your-github-repo-url>
cd group-05-final-project
npm install
cp .env.example .env
```

### 2. Set Up PostgreSQL
**Option A — Local PostgreSQL:**
```bash
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE issue_tracker;"
```
**Option B — Docker:**
```bash
docker compose up -d
```

### 3. Run the App
```bash
npm run dev
```

Once `Server is listening on port 3000` appears, open your browser to:
- **Home:** `http://localhost:3000`
- **Group:** `http://localhost:3000/group.html`
- **Schedule:** `http://localhost:3000/schedule.html`