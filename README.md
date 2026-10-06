# BudgetFlow

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" />
</p>

> A modern, self-hosted personal finance visualization application that helps you understand where your money goes through beautiful, intuitive charts.

<img width="2551" height="1031" alt="image" src="https://github.com/user-attachments/assets/175e08ed-ffd0-4c29-8d72-443972f71de3" />


---

## Features

### Interactive Charts
- **Sankey Flow** - Visualize money flow from income → categories → expenses
- **Donut Chart** - See proportional expense breakdown with category colors
- **Smart Alerts** - Warnings when expenses exceed income

### Smart Controls
- Multi-Currency support (€ $ £ CHF ¥ ₹ ₽ ₩)
- Live Updates - Edit in sidebar, see changes instantly
- Value/% Toggle - Switch between numbers and percentages
- Dark/Light Mode

### Data Management
- Local SQLite database (self-hosted)
- Single account per self-hosted installation
- Login required by default in Docker deployments; local preview remains available with authentication disabled
- JSON Export/Import for backups

---

## Self-Hosting

The recommended way to run BudgetFlow is using Docker Compose. Since the project is configured with GitHub Actions, pre-built Docker images are automatically published to the GitHub Container Registry (GHCR).

### Quick Start with Docker Compose

1. Create a directory for BudgetFlow and navigate into it:
   ```bash
   mkdir -p budgetflow && cd budgetflow
   ```

2. Create a `docker-compose.yml` file:
   ```yaml
   services:
     budgetflow:
       image: ghcr.io/kinanqaz/budget-flow:latest
       container_name: budgetflow
       ports:
         - "3000:3000"
       volumes:
         - budgetflow-data:/app/data
       environment:
         - PORT=3000
         - HOST=0.0.0.0
         - DATA_DIR=/app/data
         - JWT_SECRET=your-secure-random-string # Generate a long secure secret for login security
         - AUTH_ENABLED=true                     # Keep true for deployed instances
       restart: unless-stopped

   volumes:
     budgetflow-data:
   ```

3. Start the container in the background:
   ```bash
   docker compose up -d
   ```

4. Open your web browser and go to `http://<YOUR_SERVER_IP>:3000`. The first visit guides you through creating the single account for this instance. Later visits require signing in before showing your budget.

---

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port inside the container |
| `HOST` | `0.0.0.0` | Host binding for server socket |
| `DATA_DIR` | `/app/data` | Directory where the SQLite database is stored |
| `JWT_SECRET` | - | Secret key used to sign session tokens. Automatically generated at startup if missing. |
| `JWT_EXPIRES_IN` | `7d` | Token expiration time |
| `AUTH_ENABLED` | `true` in Docker | Enable/disable authentication. Docker images enable it by default. Set it to `false` only for a trusted local preview without sign-in. |
| `LOG_LEVEL` | `info` | Server log level (`debug`, `info`, `warn`, `error`) |

---

### Updating the Application

Since your image is hosted on GitHub Packages, updates are lightweight and instant:

1. Navigate to your app directory:
   ```bash
   cd budgetflow
   ```

2. Pull the latest image, restart the container, and clean up the old image files:
   ```bash
   docker compose pull
   docker compose up -d
   docker system prune -f
   ```

---

## Development

### Prerequisites
- Node.js 18+
- npm or bun

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env and set JWT_SECRET

# Run development server
npm run dev
```

### Tech Stack

| Technology | Purpose |
|------------|---------|
| React | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Fastify | Backend API |
| SQLite | Database |
| Docker | Self-hosting |

---

## License

MIT License - Feel free to use, modify, and distribute.

---

Built with ❤️ by Kinan
