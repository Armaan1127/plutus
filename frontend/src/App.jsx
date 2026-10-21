import { useEffect, useState } from "react";
import "./App.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";


const API_URL = "http://localhost:8000";

const expenseCategories = [
  "Food & Dining",
  "Groceries",
  "Shopping",
  "Transportation",
  "Housing",
  "Utilities",
  "Entertainment",
  "Health & Fitness",
  "Education",
  "Subscriptions",
  "Travel",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Freelance",
  "Investments",
  "Gifts",
  "Other Income",
];

function App() {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("expense");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function fetchTransactions() {
    try {
      const response = await fetch(`${API_URL}/transactions`);

      if (!response.ok) {
        throw new Error("Failed to load transactions");
      }

      const data = await response.json();
      setTransactions(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function addTransaction(event) {
    event.preventDefault();

    try {
      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          category: category === "custom" ? customCategory.trim() : category,
          description,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add transaction");
      }

      setAmount("");
      setCategory("");
      setCustomCategory("");
      setDescription("");
      setType("expense");

      await fetchTransactions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTransaction(id) {
    try {
      const response = await fetch(`${API_URL}/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      await fetchTransactions();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = totalIncome - totalExpenses;

  const availableCategories = [...new Set(
    transactions.map((transaction) => transaction.category)
  )].sort();

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType =
      filterType === "all" || transaction.type === filterType;

    const matchesCategory =
      filterCategory === "all" || transaction.category === filterCategory;

    const matchesSearch = transaction.description
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesType && matchesCategory && matchesSearch;
  });

  const spendingByCategory = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((categories, transaction) => {
      const category = transaction.category;

      categories[category] =
        (categories[category] || 0) + transaction.amount;

      return categories;
    }, {});

  const chartData = Object.entries(spendingByCategory).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const chartColors = [
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
  ];

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">P</div>

          <div>
            <h1>Plutus</h1>
            <p>Personal Finance Dashboard</p>
          </div>
        </div>

        <div className="header-badge">
          <span className="status-dot"></span>
          Financial Overview
        </div>
      </header>

      {/* Welcome */}
      <section className="welcome-section">
        <div>
          <p className="eyebrow">YOUR DASHBOARD</p>
          <h2>Overview</h2>
          <p>Track your money, manage expenses, and stay in control.</p>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="dashboard-cards">
        <div className="card balance-card">
          <div className="card-top">
            <span>Total Balance</span>
            <span className="card-icon">◈</span>
          </div>

          <h3>{formatCurrency(balance)}</h3>
          <p>Your current financial balance</p>
        </div>

        <div className="card income-card">
          <div className="card-top">
            <span>Total Income</span>
            <span className="card-icon">↗</span>
          </div>

          <h3>{formatCurrency(totalIncome)}</h3>
          <p>Money coming in</p>
        </div>

        <div className="card expense-card">
          <div className="card-top">
            <span>Total Expenses</span>
            <span className="card-icon">↘</span>
          </div>

          <h3>{formatCurrency(totalExpenses)}</h3>
          <p>Money going out</p>
        </div>
      </section>

      <section className="chart-section panel">
        <div className="section-header">
          <div>
            <h3>Spending Breakdown</h3>
            <p>See where your money is going.</p>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={120}
                  paddingAngle={4}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="chart-empty">
            Add an expense to see your spending breakdown.
          </p>
        )}
      </section>

      {/* Add Transaction */}
      <section className="panel form-section">
        <div className="section-header">
          <div>
            <h3>Add Transaction</h3>
            <p>Record a new income or expense.</p>
          </div>
        </div>

        <form className="transaction-form" onSubmit={addTransaction}>
          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => {
                setType(event.target.value);
                setCategory("");
                setCustomCategory("");
              }}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>

            <select
              id="category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setCustomCategory("");
              }}
              required
            >
              <option value="">Select Category</option>

              {(type === "expense"
                ? expenseCategories
                : incomeCategories
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}

              <option value="custom">+ Custom Category</option>
            </select>

            {category === "custom" && (
              <input
                type="text"
                placeholder="Enter custom category"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                required
              />
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              placeholder="e.g. Uniqlo"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <button className="add-btn" type="submit">
            + Add Transaction
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>

      {/* Transactions */}
      <section className="transactions-section">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>

          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
          >
            <option value="all">All Categories</option>

            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="section-header transactions-header">
          <div>
            <h3>Recent Transactions</h3>
            <p>A complete overview of your financial activity.</p>
          </div>

          <span className="transaction-count">
            {transactions.length} Transactions
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="description-cell">
                    {transaction.description}
                  </td>

                  <td>{transaction.category}</td>

                  <td>
                    <span className={`badge ${transaction.type}`}>
                      {transaction.type || "Unknown"}
                    </span>
                  </td>

                  <td
                    className={
                      transaction.type === "income"
                        ? "amount-income"
                        : "amount-expense"
                    }
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </td>

                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteTransaction(transaction.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="empty-state">
              <h4>No transactions yet</h4>
              <p>Add your first transaction to get started.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <span>Plutus © 2026</span>
        <span>Personal Finance, Simplified.</span>
      </footer>
    </div>
  );
}

export default App;