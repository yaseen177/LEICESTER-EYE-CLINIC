import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase.ts';
import Dashboard from './Dashboard.tsx';
import PatientList from './PatientList.tsx';
import PatientDetails from './PatientDetails.tsx';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      alert("Login Failed: " + error.message);
    }
  };

  if (loading) return <div>Loading System...</div>;

  if (!user) {
    return (
      <div className="login-container">
        <h2>Optician PMS Login</h2>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">Log In</button>
        </form>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        {/* TOP NAVIGATION BAR */}
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1>Leicester Eye Clinic</h1>
            <nav style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/" style={{ textDecoration: 'none', color: '#0070f3', fontWeight: '600' }}>New Patient</Link>
              <Link to="/patients" style={{ textDecoration: 'none', color: '#0070f3', fontWeight: '600' }}>Patient Database</Link>
            </nav>
          </div>
          <button onClick={() => signOut(auth)} className="secondary" style={{ padding: '0.5rem 1rem' }}>Sign Out</button>
        </header>

        {/* PAGE CONTENT SWITCHER */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientDetails />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}