import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import './App.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const monthNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const today = () => { const d = new Date(); return `${monthNow()}-${String(d.getDate()).padStart(2,'0')}`; };
const currency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const colors = ['#4f8cff', '#8b5cf6', '#16b8a6', '#f6a444', '#f06595', '#38bdf8', '#a3e635'];
const expenses = ['Food & Dining','Groceries','Shopping','Transportation','Housing','Utilities','Entertainment','Health & Fitness','Education','Subscriptions','Travel','Other'];
const incomes = ['Salary','Freelance','Investments','Gifts','Other Income'];
const blankTx = () => ({ amount: '', category: 'Food & Dining', description: '', type: 'expense', date: today() });
const blankRecurring = () => ({ ...blankTx(), day_of_month: 1, start_month: monthNow() });

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('plutus_token') || '');
  const [email, setEmail] = useState(() => sessionStorage.getItem('plutus_email') || '');
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState({ email: '', password: '' });
  const [tab, setTab] = useState('Overview');
  const [month, setMonth] = useState(monthNow());
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [goals, setGoals] = useState([]);
  const [tx, setTx] = useState(blankTx);
  const [editing, setEditing] = useState(null);
  const [budget, setBudget] = useState({ category: 'Food & Dining', amount: '' });
  const [repeat, setRepeat] = useState(blankRecurring);
  const [goal, setGoal] = useState({ name: '', target: '', saved: '0' });
  const [goalEditing, setGoalEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('plutus_token'); sessionStorage.removeItem('plutus_email');
    setToken(''); setEmail(''); setTransactions([]); setAllTransactions([]); setBudgets([]); setRecurring([]); setGoals([]);
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
    let response;
    try { response = await fetch(`${API}${path}`, { ...options, headers }); }
    catch { throw new Error('Cannot reach the API. Check the backend URL and Render status.'); }
    if (response.status === 401 || response.status === 403) {
      if (token) logout();
      throw new Error('Session expired or unauthorized. Please sign in again.');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const detail = error.detail;
      throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(x => x.msg).join('; ') : `Request failed (${response.status})`);
    }
    if (response.status === 204) return null;
    return response;
  }, [token, logout]);

  const json = useCallback(async (path, options = {}) => (await request(path, options)).json(), [request]);
  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [ts, bs, rs, gs] = await Promise.all([
        json('/transactions'), json(`/budgets?month=${month}`), json('/recurring'), json('/goals')
      ]);
      setAllTransactions(ts); setTransactions(ts.filter(t => t.date.startsWith(month)));
      setBudgets(bs); setRecurring(rs); setGoals(gs); setMessage('');
    } catch (err) { setMessage(err.message); }
  }, [token, month, json]);
  useEffect(() => { refresh(); }, [refresh]);

  async function run(action, success) {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); setMessage(success || 'Saved successfully'); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }

  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch(`${API}/auth/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(auth)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Check your email and password');
      sessionStorage.setItem('plutus_token', data.access_token);
      sessionStorage.setItem('plutus_email', data.email);
      setToken(data.access_token); setEmail(data.email); setAuth({ email: '', password: '' });
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }

  const monthlyIncome = transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const monthlyExpenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const totalBalance = allTransactions.reduce((s,t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const expenseByCategory = useMemo(() => {
    const result = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return Object.entries(result).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value);
  }, [transactions]);
  const trend = useMemo(() => {
    const totals = {};
    for (const t of allTransactions) {
      const m = t.date.slice(0,7);
      if (!totals[m]) totals[m] = { month: m, income: 0, expenses: 0 };
      totals[m][t.type === 'income' ? 'income' : 'expenses'] += t.amount;
    }
    return Object.values(totals).sort((a,b) => a.month.localeCompare(b.month)).slice(-12);
  }, [allTransactions]);
  const categoryNames = [...new Set([...expenses, ...incomes, ...allTransactions.map(t => t.category)])].sort();
  const filtered = transactions.filter(t => (filterType === 'all' || t.type === filterType) &&
    (filterCategory === 'all' || t.category === filterCategory) &&
    `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase()));

  async function submitTransaction(e) {
    e.preventDefault();
    await run(async () => {
      await json(editing ? `/transactions/${editing}` : '/transactions', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...tx, amount: Number(tx.amount) })
      });
      setTx(blankTx()); setEditing(null);
    }, editing ? 'Transaction updated' : 'Transaction added');
  }
  function editTransaction(t) { setTx({ ...t, amount: String(t.amount) }); setEditing(t.id); setTab('Transactions'); window.scrollTo({top: 0, behavior: 'smooth'}); }
  async function downloadCSV() {
    setBusy(true); setMessage('');
    try {
      const response = await request('/transactions/export');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'plutus-transactions.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  async function uploadCSV(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const body = new FormData(); body.append('file', file);
    await run(() => json('/transactions/import', { method: 'POST', body }), 'CSV imported');
    e.target.value = '';
  }
  const navigation = ['Overview','Transactions','Budgets','Recurring','Savings Goals'];

  if (!token) return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">P</div><div><h1>Plutus</h1><p>Your money, made clearer.</p></div></div>
        <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="muted">Private budgets, spending analytics, and financial goals.</p>
        <form onSubmit={authenticate} className="stack">
          <label>Email<input type="email" autoComplete="email" required value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})}/></label>
          <label>Password<input type="password" minLength="8" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/></label>
          <button disabled={busy} className="primary">{busy ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <button className="link-button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setMessage('');}}>
          {authMode==='login'?'New to Plutus? Create an account':'Already registered? Log in'}
        </button>
        {message && <p className="alert" role="alert">{message}</p>}
        <p className="small muted">Demo project. Do not upload sensitive financial information.</p>
      </div>
    </main>
  );

  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">P</div><div><h1>Plutus</h1><p>Personal Finance</p></div></div>
      <nav aria-label="Main navigation">{navigation.map(name=><button key={name} className={tab===name?'nav active':'nav'} onClick={()=>{setTab(name);setMessage('');}}>{name}</button>)}</nav>
      <div className="sidebar-bottom"><p className="small muted truncate" title={email}>{email}</p><button className="secondary" onClick={logout}>Log out</button></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">PERSONAL FINANCE</p><h2>{tab}</h2></div><label className="month-picker">Month <input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></label></header>
      {message && <div className="notice" role="status">{message}<button aria-label="Dismiss" onClick={()=>setMessage('')}>×</button></div>}

      {tab === 'Overview' && <>
        <section className="metrics">
          <div className="metric"><span>All-time balance</span><strong>{currency(totalBalance)}</strong><small>Income minus expenses</small></div>
          <div className="metric"><span>Income · {month}</span><strong className="positive">{currency(monthlyIncome)}</strong><small>Selected month</small></div>
          <div className="metric"><span>Expenses · {month}</span><strong className="negative">{currency(monthlyExpenses)}</strong><small>Selected month</small></div>
          <div className="metric"><span>Net cash flow</span><strong>{currency(monthlyIncome-monthlyExpenses)}</strong><small>Selected month</small></div>
        </section>
        <div className="two-col">
          <section className="panel"><h3>Spending breakdown</h3><p className="muted">Expenses by category for {month}</p>
            {expenseByCategory.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105}>{expenseByCategory.map((x,i)=><Cell key={x.name} fill={colors[i%colors.length]}/>)}</Pie><Tooltip formatter={currency}/><Legend /></PieChart></ResponsiveContainer></div> : <div className="empty">Add an expense to see the breakdown.</div>}
          </section>
          <section className="panel"><h3>Monthly trends</h3><p className="muted">Up to 12 months of income and expenses</p>
            {trend.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid stroke="#29384e" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fill:'#a0b0c5',fontSize:11}}/><YAxis tick={{fill:'#a0b0c5',fontSize:11}}/><Tooltip formatter={currency}/><Legend/><Area dataKey="income" stroke="#24c9a4" fill="#24c9a433"/><Area dataKey="expenses" stroke="#f49b68" fill="#f49b6833"/></AreaChart></ResponsiveContainer></div> : <div className="empty">Trends appear when you add transactions.</div>}
          </section>
        </div>
        <section className="panel"><div className="section-title"><h3>Budget progress · {month}</h3><button className="secondary" onClick={()=>setTab('Budgets')}>Manage budgets</button></div>
          {budgets.length ? <div className="budget-grid">{budgets.map(b=>{
            const spent=expenseByCategory.find(c=>c.name===b.category)?.value||0;
            const ratio=spent/b.amount;
            return <div key={b.id} className="budget-row"><div className="section-title"><strong>{b.category}</strong><span>{currency(spent)} / {currency(b.amount)}</span></div><div className="progress"><div style={{width:`${Math.min(100,ratio*100)}%`,background:ratio>1?'#ef6b75':ratio>.85?'#f6a444':'#4f8cff'}}/></div><small className="muted">{ratio>1?`${currency(spent-b.amount)} over budget`:`${currency(b.amount-spent)} remaining`}</small></div>
          })}</div> : <div className="empty">Create category budgets to track spending against your limits.</div>}
        </section>
      </>}

      {tab === 'Transactions' && <>
        <section className="panel"><h3>{editing?'Edit transaction':'Add transaction'}</h3>
          <form className="form-grid" onSubmit={submitTransaction}>
            <label>Amount<input type="number" min="0.01" step="0.01" required placeholder="0.00" value={tx.amount} onChange={e=>setTx({...tx,amount:e.target.value})}/></label>
            <label>Type<select value={tx.type} onChange={e=>setTx({...tx,type:e.target.value,category:e.target.value==='expense'?expenses[0]:incomes[0]})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
            <label>Category<input list="categories" required maxLength="100" value={tx.category} onChange={e=>setTx({...tx,category:e.target.value})}/><datalist id="categories">{(tx.type==='expense'?expenses:incomes).map(c=><option key={c} value={c}/>)}</datalist></label>
            <label>Date<input type="date" required value={tx.date} onChange={e=>setTx({...tx,date:e.target.value})}/></label>
            <label className="wide">Description<input required maxLength="300" placeholder="e.g. Groceries" value={tx.description} onChange={e=>setTx({...tx,description:e.target.value})}/></label>
            <div className="actions wide"><button className="primary" disabled={busy}>{editing?'Save changes':'Add transaction'}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setTx(blankTx());}}>Cancel</button>}</div>
          </form>
        </section>
        <section className="panel"><div className="section-title"><div><h3>Transaction history</h3><p className="muted">{filtered.length} transactions for {month}</p></div><div className="actions"><button className="secondary" disabled={busy} onClick={downloadCSV}>Export CSV</button><label className="secondary upload">Import CSV<input type="file" accept=".csv,text/csv" onChange={uploadCSV} disabled={busy} hidden/></label></div></div>
          <div className="filters"><input placeholder="Search descriptions or categories" value={search} onChange={e=>setSearch(e.target.value)}/><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select><select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="all">All categories</option>{categoryNames.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{t.category}</td><td><span className={`pill ${t.type}`}>{t.type}</span></td><td className={t.type==='income'?'positive':'negative'}>{t.type==='income'?'+':'−'}{currency(t.amount)}</td><td><div className="actions"><button className="small-btn" onClick={()=>editTransaction(t)}>Edit</button><button className="small-btn danger" disabled={busy} onClick={()=>{if(window.confirm('Delete this transaction?'))run(()=>request(`/transactions/${t.id}`,{method:'DELETE'}),'Transaction deleted');}}>Delete</button></div></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty">No transactions match your filters for this month.</div>}</div>
        </section>
      </>}

      {tab === 'Budgets' && <section className="panel"><h3>Monthly category budgets</h3><p className="muted">Set spending limits for {month}. Creating a budget for the same category updates it.</p>
        <form className="form-grid compact" onSubmit={e=>{e.preventDefault();run(async()=>{await json('/budgets',{method:'POST',body:JSON.stringify({...budget,month,amount:Number(budget.amount)})});setBudget({...budget,amount:''});},'Budget saved');}}>
          <label>Category<input list="budget-categories" value={budget.category} required onChange={e=>setBudget({...budget,category:e.target.value})}/><datalist id="budget-categories">{expenses.map(c=><option key={c} value={c}/>)}</datalist></label>
          <label>Monthly limit<input type="number" min="0.01" step="0.01" value={budget.amount} required onChange={e=>setBudget({...budget,amount:e.target.value})}/></label>
          <button className="primary" disabled={busy}>Save budget</button>
        </form>
        {budgets.length?<div className="budget-grid">{budgets.map(b=>{const spent=expenseByCategory.find(c=>c.name===b.category)?.value||0;return <div className="budget-row" key={b.id}><div className="section-title"><strong>{b.category}</strong><span>{currency(spent)} / {currency(b.amount)}</span></div><div className="progress"><div style={{width:`${Math.min(100,spent/b.amount*100)}%`,background:spent>b.amount?'#ef6b75':'#4f8cff'}}/></div><div className="actions"><button className="small-btn" onClick={()=>setBudget({category:b.category,amount:String(b.amount)})}>Edit</button><button className="small-btn danger" onClick={()=>run(()=>request(`/budgets/${b.id}`,{method:'DELETE'}),'Budget removed')}>Remove</button></div></div>})}</div>:<div className="empty">No budgets for this month.</div>}
      </section>}

      {tab === 'Recurring' && <section className="panel"><h3>Recurring transactions</h3><p className="muted">Create templates for regular payments. Click “Generate this month” to add them once; generation is not automatic.</p>
        <form className="form-grid" onSubmit={e=>{e.preventDefault();run(async()=>{await json('/recurring',{method:'POST',body:JSON.stringify({...repeat,amount:Number(repeat.amount),day_of_month:Number(repeat.day_of_month)})});setRepeat(blankRecurring());},'Recurring template saved');}}>
          <label>Description<input required value={repeat.description} onChange={e=>setRepeat({...repeat,description:e.target.value})}/></label>
          <label>Amount<input required type="number" min="0.01" step="0.01" value={repeat.amount} onChange={e=>setRepeat({...repeat,amount:e.target.value})}/></label>
          <label>Type<select value={repeat.type} onChange={e=>setRepeat({...repeat,type:e.target.value,category:e.target.value==='expense'?expenses[0]:incomes[0]})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label>Category<input list="repeat-categories" required value={repeat.category} onChange={e=>setRepeat({...repeat,category:e.target.value})}/><datalist id="repeat-categories">{(repeat.type==='expense'?expenses:incomes).map(c=><option key={c} value={c}/>)}</datalist></label>
          <label>Day of month<input type="number" min="1" max="31" required value={repeat.day_of_month} onChange={e=>setRepeat({...repeat,day_of_month:e.target.value})}/></label>
          <label>Start month<input type="month" required value={repeat.start_month} onChange={e=>setRepeat({...repeat,start_month:e.target.value})}/></label>
          <div className="actions wide"><button className="primary" disabled={busy}>Add recurring template</button><button className="secondary" type="button" disabled={busy} onClick={()=>run(()=>json(`/recurring/generate?month=${month}`,{method:'POST'}),'Generated eligible recurring transactions')}>Generate {month}</button></div>
        </form>
        <div className="table-wrap"><table><thead><tr><th>Description</th><th>Amount</th><th>Type</th><th>Day</th><th>Last generated</th><th></th></tr></thead><tbody>{recurring.map(r=><tr key={r.id}><td>{r.description}</td><td>{currency(r.amount)}</td><td>{r.type}</td><td>{r.day_of_month}</td><td>{r.last_generated_month||'Never'}</td><td><button className="small-btn danger" onClick={()=>run(()=>request(`/recurring/${r.id}`,{method:'DELETE'}),'Template removed')}>Remove</button></td></tr>)}</tbody></table>{!recurring.length&&<div className="empty">No recurring templates yet.</div>}</div>
      </section>}

      {tab === 'Savings Goals' && <section className="panel"><h3>Savings goals</h3><p className="muted">Track progress toward your personal targets. Goal balances are manually maintained.</p>
        <form className="form-grid compact" onSubmit={e=>{e.preventDefault();run(async()=>{await json(goalEditing?`/goals/${goalEditing}`:'/goals',{method:goalEditing?'PUT':'POST',body:JSON.stringify({...goal,target:Number(goal.target),saved:Number(goal.saved)})});setGoal({name:'',target:'',saved:'0'});setGoalEditing(null);},'Goal saved');}}>
          <label>Goal name<input required value={goal.name} onChange={e=>setGoal({...goal,name:e.target.value})}/></label>
          <label>Target<input required type="number" min="0.01" step="0.01" value={goal.target} onChange={e=>setGoal({...goal,target:e.target.value})}/></label>
          <label>Saved so far<input required type="number" min="0" step="0.01" value={goal.saved} onChange={e=>setGoal({...goal,saved:e.target.value})}/></label>
          <button className="primary" disabled={busy}>{goalEditing?'Update goal':'Create goal'}</button>
          {goalEditing&&<button type="button" className="secondary" onClick={()=>{setGoalEditing(null);setGoal({name:'',target:'',saved:'0'});}}>Cancel</button>}
        </form>
        <div className="budget-grid">{goals.map(g=><div className="budget-row" key={g.id}><div className="section-title"><strong>{g.name}</strong><span>{currency(g.saved)} / {currency(g.target)}</span></div><div className="progress"><div style={{width:`${Math.min(100,g.saved/g.target*100)}%`}}/></div><div className="actions"><button className="small-btn" onClick={()=>{setGoalEditing(g.id);setGoal({name:g.name,target:String(g.target),saved:String(g.saved)});}}>Edit</button><button className="small-btn danger" onClick={()=>run(()=>request(`/goals/${g.id}`,{method:'DELETE'}),'Goal deleted')}>Delete</button></div></div>)}{!goals.length&&<div className="empty">Add your first savings goal.</div>}</div>
      </section>}
      <footer>Plutus · Private accounts · Educational demo · Never enter sensitive financial information</footer>
    </main>
  </div>;
}
export default App;
