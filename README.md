# Plutus — Personal Finance Dashboard

**Live Demo:** https://plutus-ecru-pi.vercel.app

A full-stack personal finance application that helps users manage transactions, analyze spending, create budgets, and track savings goals.

Built with **React, FastAPI, and PostgreSQL**, Plutus features user authentication, interactive financial dashboards, and persistent, user-specific financial data.

## Features

### Authentication
- User registration and login with JWT-based authentication.
- Password hashing using Argon2.
- Private financial records associated with individual user accounts.

### Transaction Management
- Add, view, edit, and delete income and expense transactions.
- Organize transactions by category, date, and description.
- Import and export transaction data using CSV files.

### Financial Dashboard
- View total income, expenses, and account balance.
- Visualize spending by category.
- Analyze income and expense trends through interactive charts.
- Monitor financial activity through a responsive dashboard.

### Budget Tracking
- Create monthly budgets for spending categories.
- Track spending against budget limits.
- Visualize budget utilization and remaining balances.

### Recurring Transactions
- Create recurring income and expense templates.
- Generate transactions from recurring schedules.
- Prevent duplicate generation for the same scheduled occurrence.

### Savings Goals
- Create personalized savings goals.
- Track progress toward target amounts.
- Update savings contributions and monitor completion.

## Tech Stack

| Component | Technologies |
|-----------|-------------|
| Frontend | React, JavaScript, Vite, Recharts |
| Backend | Python, FastAPI, Pydantic |
| Database | PostgreSQL, SQLAlchemy |
| Authentication | JWT, Argon2 |
| Testing | Pytest |
| Deployment | Vercel, Render |

## Architecture

Plutus uses a client-server architecture with a RESTful API.

1. **React Frontend:** Provides the user interface, forms, financial dashboards, and interactive charts.
2. **FastAPI Backend:** Handles authentication, business logic, financial calculations, and API requests.
3. **PostgreSQL Database:** Stores user accounts, transactions, budgets, recurring templates, and savings goals.
4. **JWT Authentication:** Protects user-specific endpoints and associates financial records with authenticated accounts.

The frontend is deployed on Vercel, while the backend and PostgreSQL database are hosted on Render.

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js and npm
- PostgreSQL

### 1. Clone the Repository

```bash
git clone https://github.com/Armaan1127/plutus.git
cd plutus
```

### 2. Configure the Backend

Create a PostgreSQL database named `plutus`.

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the following environment variables:

```env
DATABASE_URL=postgresql://localhost/plutus
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters_long
FRONTEND_URL=http://localhost:5173
```

Start the API:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

Interactive API documentation is available at `http://localhost:8000/docs`.

### 3. Configure the Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Testing

The backend includes automated API tests covering core application functionality.

Run the tests from the backend directory:

```bash
pytest
```

## Deployment

Plutus is deployed using:

- **Vercel:** React frontend
- **Render:** FastAPI backend
- **Render PostgreSQL:** Relational database

Production configuration uses environment variables to manage database connections, authentication secrets, and permitted frontend origins.

## Future Improvements

- Email verification and password recovery
- Authentication rate limiting and additional security protections
- Automatic recurring transaction processing
- Expanded financial reporting and analytics
- Additional automated tests and CI/CD integration

## Disclaimer

Plutus is a portfolio project built for educational purposes. It is not intended to replace professional financial software or store sensitive banking credentials.

## Author

**Armaan Singh**

GitHub: https://github.com/Armaan1127