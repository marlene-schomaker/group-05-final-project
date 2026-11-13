# Group 05 Final Project

## Quick Start (Ubuntu/WSL)

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
