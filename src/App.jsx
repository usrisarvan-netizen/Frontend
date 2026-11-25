import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

const ADMIN_EMAIL = 'usrisarvan@gmail.com'
const ADMIN_PASSWORD = 'Sri@4321'
const DEFAULT_GROUP_LINK =
  import.meta.env.VITE_GROUP_LINK || 'https://chat.whatsapp.com/E5M5aok7zrEGppgG9O8sD6'

function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function AuthCard({ children, register = false }) {
  return (
    <main className="auth-page">
      <div className={`auth-card ${register ? 'register-card' : ''}`}>
        <div className="brand"><div style={{ fontSize: 34 }}>🩸</div><h1>PulseLink</h1><p>Blood Banking System</p></div>
        {children}
      </div>
    </main>
  )
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', role: 'user' })
  const [message, setMessage] = useState(null)
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = (event) => {
    event.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (form.role === 'user' && email === ADMIN_EMAIL) {
      setMessage({ type: 'error', text: 'The administrator account cannot log in as a regular user.' })
      return
    }
    if (form.role === 'admin') {
      if (email !== ADMIN_EMAIL) {
        setMessage({ type: 'error', text: 'Only usrisarvan@gmail.com is authorized as administrator.' })
        return
      }
      if (form.password !== ADMIN_PASSWORD) {
        setMessage({ type: 'error', text: 'Invalid administrator password.' })
        return
      }
      localStorage.setItem('loggedIn', 'admin')
      localStorage.setItem('currentUser', JSON.stringify({ name: 'usrisarvan', email: ADMIN_EMAIL, role: 'admin', permissions: 'full_control' }))
      navigate('/admin')
      return
    }
    const users = getJson('users', [])
    const matched = users.find((user) => user.email?.toLowerCase() === email && user.password === form.password)
    const fallback = email === 'user@pulselink.com' && form.password === 'user123'
      ? { name: 'Regular Donor', email, phone: '+91 9876543210', bloodGroup: 'O+', password: 'user123', role: 'user' }
      : null
    const user = matched || fallback
    if (!user) {
      setMessage({ type: 'error', text: 'Invalid email or password. Please verify your credentials.' })
      return
    }
    localStorage.setItem('loggedIn', 'user')
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('currentUser', JSON.stringify({ name: user.name, email: user.email, role: 'user' }))
    navigate('/user')
  }

  return (
    <AuthCard>
      <form onSubmit={submit}>
        {message && <div className={`message ${message.type}`}>{message.text}</div>}
        <label htmlFor="email">Email</label><input id="email" name="email" type="email" value={form.email} onChange={update} required />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" value={form.password} onChange={update} required />
        <label htmlFor="role">Login As</label>
        <select id="role" name="role" value={form.role} onChange={update}><option value="user">User (Donors / General Users)</option><option value="admin">Admin (System Director Only)</option></select>
        <button className="btn btn-primary primary" type="submit">Login</button>
      </form>
      <div className="auth-switch">Don&apos;t have an account? <Link to="/register">Register</Link></div>
    </AuthCard>
  )
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', bloodGroup: '', channel: 'both', password: '', confirmPassword: '' })
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [registeredInfo, setRegisteredInfo] = useState(null)
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setMessage(null)
    const email = form.email.trim()
    if (email.toLowerCase() === ADMIN_EMAIL) {
      setMessage({ type: 'error', text: 'This email is reserved for the administrator.' })
      return
    }
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setMessage({ type: 'error', text: 'Please enter a valid 10-digit mobile number (with optional country code).' })
      return
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    const users = getJson('users', [])
    if (users.some((user) => user.email?.toLowerCase() === email.toLowerCase())) {
      setMessage({ type: 'error', text: 'An account with this email already exists.' })
      return
    }

    setSubmitting(true)
    let groupLink = DEFAULT_GROUP_LINK
    let deliveryStatus = ''
    let preview = `Welcome to PulseLink Blood Bank, ${form.name.trim()}!\nThank you for registering as a life saver.\nJoin our WhatsApp donor group here: ${groupLink}`
    const phoneDigitsOnly = form.phone.replace(/\D/g, '')
    const formattedPhone = phoneDigitsOnly.length === 10 ? `+91${phoneDigitsOnly}` : `+${phoneDigitsOnly}`
    let whatsappDirectUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(preview)}`
    let smsDirectUrl = `sms:${formattedPhone}?body=${encodeURIComponent(preview)}`

    try {
      const response = await fetch('/api/welcome-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email,
          phone: form.phone.trim(),
          bloodGroup: form.bloodGroup,
          channel: form.channel,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (data.groupLink) groupLink = data.groupLink
      if (data.preview) preview = data.preview
      if (data.whatsappDirectUrl) whatsappDirectUrl = data.whatsappDirectUrl
      if (data.smsDirectUrl) smsDirectUrl = data.smsDirectUrl
      if (response.ok) {
        const channelsList = data.results ? Object.values(data.results) : []
        if (channelsList.length > 0) {
          deliveryStatus = channelsList
            .map((item) => {
              const label =
                item.channel === 'whatsapp'
                  ? 'WhatsApp'
                  : item.channel === 'email'
                    ? 'Email'
                    : 'SMS'
              if (!item.success) return `${label}: ${item.error || 'failed'}`
              return item.simulated
                ? `${label}: simulated for ${item.to} (add SMTP_USER & SMTP_PASS in server/.env for real inbox delivery)`
                : `${label}: sent to ${item.to}`
            })
            .join(' • ')
        } else {
          deliveryStatus = data.simulated
            ? `Welcome message prepared for ${data.to}.`
            : `Welcome message sent to ${data.to} with the group invite link!`
        }
      } else {
        deliveryStatus =
          data.error ||
          (response.status >= 500
            ? 'Notification server (port 4000) is not running. Use the 1-click buttons below or run: npm run dev:server'
            : 'Could not auto-send right now — use the 1-click WhatsApp/SMS buttons below.')
      }
    } catch {
      deliveryStatus = 'Notification server is offline — use the 1-click WhatsApp/SMS buttons below or run: npm run dev:server'
    } finally {
      setSubmitting(false)
    }

    const user = {
      name: form.name.trim(),
      email,
      phone: form.phone.trim(),
      bloodGroup: form.bloodGroup,
      channel: form.channel,
      password: form.password,
      role: 'user',
      welcomeGroupLink: groupLink,
      welcomePreview: preview,
    }
    users.push(user)
    localStorage.setItem('users', JSON.stringify(users))
    localStorage.setItem('user', JSON.stringify(user))
    setMessage({ type: 'success', text: 'Registration successful!' })
    setRegisteredInfo({
      name: user.name,
      phone: user.phone,
      groupLink,
      deliveryStatus,
      preview,
      whatsappDirectUrl,
      smsDirectUrl,
    })
  }

  if (registeredInfo) {
    return (
      <AuthCard register>
        <div className="message success">Registration successful! Welcome, {registeredInfo.name}.</div>
        <div className="welcome-box">
          <p style={{ fontSize: 14 }}><strong>Mobile Notification:</strong> {registeredInfo.deliveryStatus}</p>
          <div className="welcome-preview">{registeredInfo.preview}</div>
          <div className="welcome-actions">
            <a className="btn btn-primary" href={registeredInfo.groupLink} target="_blank" rel="noopener noreferrer">
              Join Community Group
            </a>
            <div className="welcome-direct-row">
              <a className="btn btn-secondary" href={registeredInfo.whatsappDirectUrl} target="_blank" rel="noopener noreferrer">
                Send via WhatsApp
              </a>
              <a className="btn btn-secondary" href={registeredInfo.smsDirectUrl}>
                Send via SMS
              </a>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/')}>
              Continue to Login
            </button>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard register>
      <form onSubmit={submit}>
        {message && <div className={`message ${message.type}`}>{message.text}</div>}
        {[['name','Full Name','text','e.g. Aarav Sharma'],['email','Email','email','name@example.com'],['phone','Mobile Number','tel','+91 9876543210'],['password','Password','password',''],['confirmPassword','Confirm Password','password','']].map(([name,label,type,placeholder]) => (
          <div key={name}><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} placeholder={placeholder} value={form[name]} onChange={update} required /></div>
        ))}
        <label htmlFor="bloodGroup">Blood Group</label>
        <select id="bloodGroup" name="bloodGroup" value={form.bloodGroup} onChange={update} required><option value="">Select Blood Group</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}</select>
        <label htmlFor="channel">Welcome Message Channel</label>
        <select id="channel" name="channel" value={form.channel} onChange={update}>
          <option value="both">WhatsApp &amp; Mobile SMS (Both)</option>
          <option value="whatsapp">WhatsApp Only</option>
          <option value="sms">Mobile SMS Only</option>
        </select>
        <button className="btn btn-primary primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      <div className="auth-switch">Already have an account? <Link to="/">Login</Link></div>
    </AuthCard>
  )
}

function PortalLayout({ role, title, sidebar, content }) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(localStorage.getItem('BBS_THEME') || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('BBS_THEME', theme)
  }, [theme])
  const logout = () => {
    localStorage.removeItem('loggedIn')
    localStorage.removeItem('currentUser')
    navigate('/')
  }
  return (
    <div className="portal-shell">
      <header className="portal-header"><div className="header-brand"><span>🩸</span><span>PulseLink</span></div><div className="header-actions">
        <select aria-label="Theme" className="btn btn-secondary" value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="navy">Navy</option><option value="emerald">Emerald</option><option value="saffron">Saffron</option></select>
        <button className="btn btn-secondary" onClick={logout}>Logout</button>
      </div></header>
      <div className="portal-layout"><aside className="portal-sidebar"><nav>{sidebar}</nav></aside><main className="portal-content"><div className="portal-title"><h1>{title}</h1><p>{role}</p></div>{content}</main></div>
    </div>
  )
}

function Metric({ title, value, detail }) {
  return <div className="metric-card"><h3>{title}</h3><strong>{value}</strong><p>{detail}</p></div>
}

const inventory = [
  ['BAG-2026-1001','O-','PRBC','12','Available'], ['BAG-2026-1002','A+','PRBC','28','Available'],
  ['BAG-2026-1003','B+','PLT','8','Testing'], ['BAG-2026-1004','AB+','FFP','18','Available'],
]

function InventoryTable() {
  return <table className="data-table"><thead><tr><th>Bag ID</th><th>Group</th><th>Component</th><th>Units</th><th>Status</th></tr></thead><tbody>{inventory.map(row => <tr key={row[0]}>{row.map((cell,index) => <td key={index}>{index === 4 ? <span className={`badge ${cell === 'Testing' ? 'warning' : ''}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table>
}

function RequestTable() {
  const rows=[['REQ-2026-4001','AIIMS Trauma','O-','CRITICAL','Reserved'],['REQ-2026-4002','Apollo Hospitals','A+','URGENT','Pending'],['REQ-2026-4003','CMC Vellore','AB-','ROUTINE','In Transit']]
  return <table className="data-table"><thead><tr><th>Request</th><th>Hospital</th><th>Group</th><th>Urgency</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell,index) => <td key={index}>{index===3 ? <span className={`badge ${cell==='CRITICAL'?'danger':cell==='URGENT'?'warning':''}`}>{cell}</span>:cell}</td>)}</tr>)}</tbody></table>
}

function DonorTable() {
  const rows=[['Rohan Sharma','O-','14','Eligible'],['Priya Patel','A+','6','Not eligible'],['Vikram Malhotra','B+','20','Eligible'],['Sneha Sengupta','AB-','8','Eligible']]
  return <table className="data-table"><thead><tr><th>Name</th><th>Blood Group</th><th>Donations</th><th>Eligibility</th></tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell,index) => <td key={index}>{index===3 ? <span className={`badge ${cell==='Not eligible'?'warning':''}`}>{cell}</span>:cell}</td>)}</tr>)}</tbody></table>
}

function CampTable() {
  return <table className="data-table"><thead><tr><th>Camp</th><th>Location</th><th>Date</th><th>Target</th></tr></thead><tbody><tr><td>National College Drive</td><td>New Delhi</td><td>28 Nov 2026</td><td><span className="badge">180 units</span></td></tr><tr><td>Community Blood Day</td><td>Bengaluru</td><td>02 Dec 2026</td><td><span className="badge">120 units</span></td></tr></tbody></table>
}

function Admin() {
  if (localStorage.getItem('loggedIn') !== 'admin') return <Navigate to="/" replace />
  const [active,setActive]=useState('Dashboard')
  const [selectedGroup,setSelectedGroup]=useState('O-')
  const sections=['Dashboard','Inventory','Requests','Donors','Compatibility','Camps','Reports','Audit']
  const icons=['🏠','📦','🚨','👥','🔬','⛺','📊','🛡️']
  const compatibility={
    'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+']
  }
  const sidebar=sections.map((section,index)=><button key={section} className={active===section?'active':''} onClick={()=>setActive(section)}><span>{icons[index]}</span><span>{section}</span></button>)
  let content
  if(active==='Dashboard') content=<><div className="metric-grid"><Metric title="Blood Units" value="66" detail="Available tested bags"/><Metric title="Active Donors" value="12" detail="Registered life savers"/><Metric title="STAT Requests" value="4" detail="Emergency queue"/><Metric title="Donation Camps" value="6" detail="Upcoming and active"/></div><div className="panel-grid"><div className="panel"><h2>Recent Emergency Requests</h2><RequestTable/></div><div className="panel"><h2>Inventory Status</h2><InventoryTable/></div></div></>
  else if(active==='Inventory') content=<div className="panel"><h2>Live Blood Inventory</h2><InventoryTable/></div>
  else if(active==='Requests') content=<div className="panel"><h2>Emergency Blood Requests</h2><RequestTable/></div>
  else if(active==='Donors') content=<div className="panel"><h2>Registered Donors</h2><DonorTable/></div>
  else if(active==='Compatibility') content=<div className="panel"><h2>RBC Compatibility Calculator</h2><div className="compat-grid" style={{margin:'18px 0'}}>{Object.keys(compatibility).map(group=><button key={group} className={selectedGroup===group?'active':''} onClick={()=>setSelectedGroup(group)}>{group}</button>)}</div><p><strong>{selectedGroup}</strong> can receive from: <span className="badge">{compatibility[selectedGroup].join(', ')}</span></p></div>
  else if(active==='Camps') content=<div className="panel"><h2>Donation Camps</h2><CampTable/></div>
  else if(active==='Reports') content=<div className="panel-grid"><div className="panel"><h2>Monthly Collections</h2><SimpleBars values={[62,74,58,82,69,91]} labels={['Jun','Jul','Aug','Sep','Oct','Nov']}/></div><div className="panel"><h2>Component Distribution</h2><SimpleBars values={[40,28,18,12]} labels={['PRBC','WB','PLT','FFP']}/></div></div>
  else content=<div className="panel"><h2>System Audit Trail</h2><table className="data-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody><tr><td>2026-11-21 00:12</td><td>usrisarvan</td><td>STOCK_UPDATE</td><td>Reserved unit BAG-2026-1001</td></tr><tr><td>2026-11-21 00:08</td><td>System</td><td>REQUEST_CREATED</td><td>Created REQ-2026-4002</td></tr></tbody></table></div>
  return <PortalLayout role="System Administrator • Full Control" title={`${active} | Admin Command Center`} sidebar={sidebar} content={content}/>
}

function SimpleBars({values,labels=[]}) {
  return <div style={{display:'flex',alignItems:'end',gap:12,height:180,paddingTop:20}}>{values.map((value,index)=><div key={index} style={{flex:1,textAlign:'center'}}><div style={{height:`${value*1.5}px`,maxHeight:150,background:'var(--primary)',borderRadius:'6px 6px 0 0'}}/><small>{labels[index]||index+1}</small></div>)}</div>
}

function UserPortal() {
  if(localStorage.getItem('loggedIn')!== 'user') return <Navigate to="/" replace />
  const user=getJson('user',{name:'LifeSaver',email:'user@pulselink.com',bloodGroup:'O+'})
  const [active,setActive]=useState('Dashboard')
  const sections=['Dashboard','Profile','Donations','Appointments','Find Blood','Request Blood','Camps','Donor Card','Notifications']
  const icons=['🏠','👤','🩸','📅','🔍','🚨','⛺','💳','🔔']
  const sidebar=sections.map((section,index)=><button key={section} className={active===section?'active':''} onClick={()=>setActive(section)}><span>{icons[index]}</span><span>{section}</span></button>)
  let content
  if(active==='Dashboard') content=<><div className="metric-grid"><Metric title="Blood Group" value={user.bloodGroup||'O+'} detail="Verified profile"/><Metric title="Donations" value="3" detail="1,050 ml contributed"/><Metric title="Lives Impacted" value="9" detail="Transfusions facilitated"/><Metric title="Next Appointment" value="1" detail="Upcoming drive"/></div><div className="quick-actions">{['Find Blood','Request Blood','Appointments','Camps'].map(label=><button className="btn btn-primary" key={label} onClick={()=>setActive(label)}>{label}</button>)}</div><div className="panel-grid"><div className="panel"><h2>Upcoming Appointment</h2><p style={{marginTop:12}}>15 October 2026 • 10:00 AM</p><p>PulseLink Blood Center</p><span className="badge" style={{marginTop:12}}>Confirmed</span></div><div className="panel"><h2>Eligibility Status</h2><p style={{marginTop:12}}>✓ Profile and consent verified</p><p>✓ Eligible for the next donation</p><span className="badge" style={{marginTop:12}}>Medical clearance: Fit</span></div></div></>
  else if(active==='Profile') content=<div className="panel"><h2>My Profile</h2><div className="form-grid" style={{marginTop:16}}><label>Name<input value={user.name||''} readOnly/></label><label>Email<input value={user.email||''} readOnly/></label><label>Phone<input value={user.phone||''} readOnly/></label><label>Blood Group<input value={user.bloodGroup||''} readOnly/></label></div></div>
  else if(active==='Donations') content=<div className="panel"><h2>Donation History</h2><DonorTable/></div>
  else if(active==='Appointments') content=<div className="panel"><h2>Schedule Donation</h2><div className="form-grid" style={{marginTop:16}}><label>Date<input type="date"/></label><label>Center<select><option>PulseLink Main Branch</option><option>Indian Red Cross Center</option></select></label><button className="btn btn-primary" style={{alignSelf:'end'}}>Book Appointment</button></div></div>
  else if(active==='Find Blood') content=<div className="panel"><h2>Available Blood Stock</h2><InventoryTable/></div>
  else if(active==='Request Blood') content=<div className="panel"><h2>Request Blood Unit</h2><div className="form-grid" style={{marginTop:16}}><label>Patient Name<input/></label><label>Blood Group<select>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}</select></label><label>Hospital<input/></label><label>Urgency<select><option>Routine</option><option>Urgent</option><option>STAT</option></select></label><button className="btn btn-primary" style={{alignSelf:'end'}}>Submit Request</button></div></div>
  else if(active==='Camps') content=<div className="panel"><h2>Donation Camps</h2><CampTable/></div>
  else if(active==='Donor Card') content=<div className="panel" style={{maxWidth:420,background:'var(--primary)',color:'white'}}><h2>PulseLink LifeSaver</h2><p style={{margin:'18px 0'}}>{user.name}</p><strong>{user.bloodGroup||'O+'}</strong><p style={{marginTop:18}}>PL-DON-1001 • Verified Donor</p></div>
  else content=<div className="panel"><h2>Notifications</h2><div className="welcome-box"><p><strong>Welcome to PulseLink, {user.name}!</strong></p><p style={{fontSize:14,color:'var(--text-muted)'}}>Join our donor community group to stay updated on blood drives and urgent requests.</p><a className="btn btn-primary" style={{width:'fit-content',textDecoration:'none'}} href={user.welcomeGroupLink||DEFAULT_GROUP_LINK} target="_blank" rel="noopener noreferrer">Join Community Group</a></div></div>
  return <PortalLayout role={`Donor Portal • ${user.name}`} title={`Welcome, ${user.name}${active==='Dashboard'?' 👋':''}`} sidebar={sidebar} content={content}/>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login/>}/>
      <Route path="/register" element={<Register/>}/>
      <Route path="/admin" element={<Admin/>}/>
      <Route path="/admin.html" element={<Admin/>}/>
      <Route path="/dash.html" element={<Admin/>}/>
      <Route path="/user" element={<UserPortal/>}/>
      <Route path="/user.html" element={<UserPortal/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default App
