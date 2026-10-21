# Plutus — Personal Finance Dashboard

Plutus is a full-stack personal finance application that helps users track income, manage expenses, and visualize their spending habits through an interactive dashboard.

**Live Demo:** https://plutus-hy7t8t99d-armaan1127.vercel.app

## Features

- **Transaction Management:** Add and delete income and expense transactions.
- **Financial Dashboard:** View total income, expenses, and current balance.
- **Spending Visualization:** Interactive donut chart showing expenses by category.
- **Transaction Filtering:** Filter transactions by type and category.
- **Search:** Find transactions using descriptions.
- **Custom Categories:** Create personalized transaction categories.
- **Persistent Storage:** Store transactions in a PostgreSQL database.
- **Responsive Design:** Modern dashboard optimized for different screen sizes.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL, SQLAlchemy |
| Visualization | Recharts |
| Deployment | Vercel, Render |
| Version Control | Git, GitHub |

## Architecture

The React frontend communicates with a FastAPI REST API using HTTP requests.

FastAPI handles transaction operations and interacts with PostgreSQL through SQLAlchemy.

```text
React Frontend (Vercel)
         |
         | HTTP / JSON
         v
FastAPI Backend (Render)
         |
         | SQLAlchemy
         v
PostgreSQL Database (Render)
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/transactions` | Retrieve transactions |
| POST | `/transactions` | Create a transaction |
| DELETE | `/transactions/{id}` | Delete a transaction |

## Running Locally

### Prerequisites

- Python 3
- Node.js and npm
- PostgreSQL

### Backend

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Set the `DATABASE_URL` environment variable to your PostgreSQL connection string.

5. Start the API:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

### Frontend

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

To connect to a different backend, configure the `VITE_API_URL` environment variable.

## Future Improvements

- User authentication and individual accounts
- Monthly spending trends and analytics
- Budget creation and tracking
- Transaction editing
- CSV import and export

## Project Status

Plutus is deployed and functional as a public demonstration.

**Note:** The current demo does not support individual user accounts. Transactions are shared across visitors. Do not enter sensitive financial information.