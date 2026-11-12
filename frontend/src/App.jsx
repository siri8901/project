import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ShieldCheck, Wallet, Plus, LogOut, RefreshCw, Eye, EyeOff, Activity, Landmark, CircleDollarSign } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const money = (value, currency='INR') => new Intl.NumberFormat('en-IN', { style:'currency', currency }).format(Number(value || 0));
const date = (value) => new Date(value).toLocaleString();

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...options?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('bv_token') || '');
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('overview');
  const [authMode, setAuthMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [auth, setAuth] = useState({ name:'', email:'admin@balancevault.local', password:'Admin@12345' });
  const [newAccount, setNewAccount] = useState({ name:'Daily spending', currency:'INR' });
  const [transfer, setTransfer] = useState({ fromAccountId:'', toAccountId:'', amount:'' });
  const [fund, setFund] = useState({ accountId:'', amount:'1000' });

  async function loadDashboard(t=token) {
    const [me, accts] = await Promise.all([request('/api/me',{token:t}), request('/api/accounts',{token:t})]);
    setUser(me.user); setAccounts(accts.accounts);
    if (!selected && accts.accounts[0]) setSelected(accts.accounts[0].id);
    if (me.user.role === 'ADMIN') {
      const audit = await request('/api/admin/audit-logs',{token:t});
      setLogs(audit.logs);
    }
  }
  useEffect(() => {
    if (token) loadDashboard().catch((e)=>{setError(e.message); logout();});
  }, [token]);
  useEffect(() => {
    if (token && selected) request(`/api/accounts/${selected}/ledger`,{token}).then(d=>setEntries(d.entries)).catch(e=>setError(e.message));
  }, [token, selected, accounts.length]);

  function logout() { localStorage.removeItem('bv_token'); setToken(''); setUser(null); setAccounts([]); setEntries([]); setLogs([]); }
  function flash(message) { setNotice(message); setError(''); }
  function fail(e) { setError(e.message); setNotice(''); }

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true);
    try {
      const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await request(path,{method:'POST',body:JSON.stringify(auth)});
      localStorage.setItem('bv_token',data.token); setToken(data.token); setUser(data.user); flash(authMode === 'login' ? 'Welcome back.' : 'Your account is ready.');
    } catch(e) { fail(e); } finally { setBusy(false); }
  }
  async function createAccount(e) {
    e.preventDefault(); setBusy(true);
    try { await request('/api/accounts',{token,method:'POST',body:JSON.stringify(newAccount)}); await loadDashboard(); flash('Account created successfully.'); }
    catch(e){fail(e);} finally{setBusy(false);}
  }
  async function makeTransfer(e) {
    e.preventDefault(); setBusy(true);
    try {
      const data = await request('/api/transfers',{token,method:'POST',body:JSON.stringify(transfer)});
      await loadDashboard(); setSelected(transfer.fromAccountId); setTransfer({...transfer,amount:''});
      flash(`Transfer complete · ${data.transfer.reference}`);
    } catch(e){fail(e);} finally{setBusy(false);}
  }
  async function fundAccount(e) {
    e.preventDefault(); setBusy(true);
    try {
      await request('/api/admin/fund',{token,method:'POST',body:JSON.stringify(fund)});
      await loadDashboard(); flash('Demo funds added and recorded in the ledger.');
    } catch(e){fail(e);} finally{setBusy(false);}
  }
  const total = useMemo(()=>accounts.reduce((sum,a)=>sum+Number(a.balance),0),[accounts]);
  const selectedAccount = accounts.find(a=>a.id===selected);
  const fmt = (v,c) => money(v,c);

  if (!token || !user) return <div className="auth-page"><div className="auth-brand"><div className="brand-mark">B</div><span>BalanceVault</span><span className="secure">SECURE LEDGER</span></div><div className="auth-card"><div className="auth-kicker">MONEY MOVEMENT, MADE TRACEABLE</div><h1>{authMode==='login'?'Welcome back':'Create your account'}</h1><p className="muted">A clear view of every account, transfer, and ledger entry.</p><form onSubmit={submitAuth} className="form">
    {authMode==='register' && <label>Full name<input required minLength="2" value={auth.name} onChange={e=>setAuth({...auth,name:e.target.value})} placeholder="Your name"/></label>}
    <label>Email address<input required type="email" value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} placeholder="you@example.com"/></label>
    <label>Password<input required type="password" minLength={authMode==='register'?10:1} value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/>{authMode==='register'&&<small>Use at least 10 characters.</small>}</label>
    {error&&<div className="alert error">{error}</div>}
    <button className="primary full" disabled={busy}>{busy?'Please wait…':authMode==='login'?'Sign in':'Create account'}</button>
  </form><div className="switch-auth">{authMode==='login'?"Don't have an account?":"Already registered?"} <button className="text-button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('');}}> {authMode==='login'?'Create account':'Sign in'}</button></div><div className="demo-note"><ShieldCheck size={16}/> Demo admin: admin@balancevault.local / Admin@12345</div></div><p className="auth-foot">BALANCEVAULT · CHALLENGE DEMO · NOT A BANK</p></div>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">B</div><span>BalanceVault</span></div><div className="side-label">WORKSPACE</div><button className={`nav-item ${tab==='overview'?'active':''}`} onClick={()=>setTab('overview')}><Activity size={18}/> Overview</button><button className={`nav-item ${tab==='transfer'?'active':''}`} onClick={()=>setTab('transfer')}><ArrowLeftRight size={18}/> Transfers</button><button className={`nav-item ${tab==='ledger'?'active':''}`} onClick={()=>setTab('ledger')}><Landmark size={18}/> Ledger</button>{user.role==='ADMIN'&&<><div className="side-label admin-label">ADMINISTRATION</div><button className={`nav-item ${tab==='audit'?'active':''}`} onClick={()=>setTab('audit')}><ShieldCheck size={18}/> Audit trail</button><button className={`nav-item ${tab==='fund'?'active':''}`} onClick={()=>setTab('fund')}><CircleDollarSign size={18}/> Demo funding</button></>}<div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div><b>{user.name}</b><small>{user.role}</small></div></div><button className="logout" onClick={logout}><LogOut size={16}/> Sign out</button></div></aside>
    <main className="main"><header className="topbar"><div><div className="crumb">Workspace / <b>{tab==='overview'?'Overview':tab==='transfer'?'Transfers':tab==='ledger'?'Ledger':tab==='audit'?'Audit trail':'Demo funding'}</b></div><h2>{tab==='overview'?'Good to see you, '+user.name.split(' ')[0]:tab==='transfer'?'Move money':tab==='ledger'?'Account ledger':tab==='audit'?'Audit trail':'Demo funding'}</h2></div><div className="top-actions"><span className="role-pill"><span/> {user.role}</span><button className="icon-btn" onClick={()=>loadDashboard()} title="Refresh"><RefreshCw size={17}/></button><div className="avatar">{user.name?.[0]?.toUpperCase()}</div></div></header>
    {(notice||error)&&<div className={`alert ${error?'error':'success'}`}>{error||notice}<button onClick={()=>{setError('');setNotice('');}}>×</button></div>}
    {tab==='overview'&&<><section className="stats-grid"><div className="stat-card balance-card"><div className="stat-top"><span>Total balance</span><button className="icon-btn" onClick={()=>setShowBalance(!showBalance)}>{showBalance?<Eye size={17}/>:<EyeOff size={17}/>}</button></div><div className="balance-number">{showBalance?fmt(total):'••••••••'}</div><div className="stat-foot"><span className="tiny-dot"/> Across {accounts.length} account{accounts.length===1?'':'s'}</div></div><div className="stat-card"><div className="stat-icon"><Wallet size={19}/></div><span className="stat-caption">Active accounts</span><div className="stat-value">{accounts.length}</div><div className="stat-foot">Your personal wallets</div></div><div className="stat-card"><div className="stat-icon green"><ShieldCheck size={19}/></div><span className="stat-caption">Ledger integrity</span><div className="stat-value">Tracked</div><div className="stat-foot">Transfers recorded in pairs</div></div></section>
    <section className="section-head"><div><h3>Your accounts</h3><p>Manage your money across accounts.</p></div><button className="primary" onClick={()=>setTab('new-account')}><Plus size={16}/> New account</button></section>
    <section className="account-grid">{accounts.length===0?<div className="empty">No accounts yet. Create your first account to get started.</div>:accounts.map((a,i)=><article className={`account-card card-${i%3}`} key={a.id} onClick={()=>{setSelected(a.id);setTab('ledger')}}><div className="account-top"><div className="account-icon"><Wallet size={19}/></div><span className="currency">{a.currency} · WALLET</span></div><div className="account-name">{a.name}</div><div className="account-balance">{fmt(a.balance,a.currency)}</div><div className="account-bottom"><span>View ledger</span><ArrowUpRight size={16}/></div></article>)}</section>
    <section className="section-head"><div><h3>Recent activity</h3><p>Latest entries for your selected account.</p></div><button className="subtle" onClick={()=>setTab('ledger')}>View ledger <ArrowUpRight size={15}/></button></section><LedgerRows entries={entries.slice(0,5)}/></>}
    {tab==='transfer'&&<section className="content-card narrow"><div className="panel-icon"><ArrowLeftRight/></div><h3>New transfer</h3><p className="muted">Move funds between accounts you own. Both ledger entries are created atomically.</p><form className="form" onSubmit={makeTransfer}><label>From account<select required value={transfer.fromAccountId} onChange={e=>setTransfer({...transfer,fromAccountId:e.target.value})}><option value="">Select source</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {fmt(a.balance,a.currency)}</option>)}</select></label><div className="swap-icon"><ArrowDownLeft/></div><label>To account<select required value={transfer.toAccountId} onChange={e=>setTransfer({...transfer,toAccountId:e.target.value})}><option value="">Select destination</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Amount<input required type="number" min="0.01" step="0.01" value={transfer.amount} onChange={e=>setTransfer({...transfer,amount:e.target.value})} placeholder="0.00"/></label><button className="primary full" disabled={busy||accounts.length<2}>{busy?'Processing…':'Confirm transfer'}</button>{accounts.length<2&&<small>Create at least two accounts before making a transfer.</small>}</form></section>}
    {tab==='ledger'&&<section className="content-card"><div className="ledger-toolbar"><div><h3>Transaction history</h3><p className="muted">A chronological record of credits and debits.</p></div><select value={selected} onChange={e=>setSelected(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>{selectedAccount&&<div className="ledger-summary"><span>{selectedAccount.name}</span><b>{fmt(selectedAccount.balance,selectedAccount.currency)}</b></div>}<LedgerRows entries={entries}/></section>}
    {tab==='audit'&&user.role==='ADMIN'&&<section className="content-card"><h3>System audit trail</h3><p className="muted">Admin-only record of security-sensitive actions.</p><div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Entity</th><th>Time</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td><span className="action-tag">{l.action}</span></td><td>{l.actor?.email||'System'}</td><td>{l.entityType}</td><td>{date(l.createdAt)}</td></tr>)}</tbody></table>{logs.length===0&&<div className="empty">No audit events yet.</div>}</div></section>}
    {tab==='fund'&&user.role==='ADMIN'&&<section className="content-card narrow"><div className="panel-icon"><CircleDollarSign/></div><h3>Demo funding</h3><p className="muted">Local evaluation helper. This is not a customer deposit feature.</p><form className="form" onSubmit={fundAccount}><label>Account<select required value={fund.accountId} onChange={e=>setFund({...fund,accountId:e.target.value})}><option value="">Select account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Amount<input required type="number" min="0.01" step="0.01" value={fund.amount} onChange={e=>setFund({...fund,amount:e.target.value})}/></label><button className="primary full" disabled={busy||!fund.accountId}>Add demo funds</button></form></section>}
    {tab==='new-account'&&<section className="content-card narrow"><div className="panel-icon"><Plus/></div><h3>Create account</h3><p className="muted">Create a wallet to organize your funds.</p><form className="form" onSubmit={createAccount}><label>Account name<input required minLength="2" maxLength="40" value={newAccount.name} onChange={e=>setNewAccount({...newAccount,name:e.target.value})}/></label><label>Currency<select value={newAccount.currency} onChange={e=>setNewAccount({...newAccount,currency:e.target.value})}><option value="INR">INR · Indian Rupee</option><option value="USD">USD · US Dollar</option></select></label><button className="primary full" disabled={busy}>Create account</button></form></section>}
    <footer className="main-footer"><span>BalanceVault © 2026</span><span><ShieldCheck size={14}/> Secured session · Demo environment</span></footer>
    </main>
  </div>;
}

function LedgerRows({entries}) {
  if (!entries?.length) return <div className="empty">No transactions yet. Your account activity will appear here.</div>;
  return <div className="ledger-list">{entries.map(e=><div className="ledger-row" key={e.id}><div className={`entry-icon ${e.type==='CREDIT'?'credit':'debit'}`}>{e.type==='CREDIT'?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</div><div className="entry-info"><b>{e.description||'Account activity'}</b><small>{date(e.createdAt)} · {e.type}</small></div><strong className={e.type==='CREDIT'?'positive':'negative'}>{e.type==='CREDIT'?'+':'−'}{money(e.amount)}</strong></div>)}</div>;
}
