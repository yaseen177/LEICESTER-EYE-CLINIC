// App.tsx
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase.ts';
import Dashboard from './Dashboard.tsx';

export default function App() {
  // We explicitly tell React that 'user' can be a Firebase User object or null
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
      <div className="login-container" style={{ padding: '2rem' }}>
        <h2>Optician PMS Login</h2>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ display: 'block', margin: '10px 0' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ display: 'block', margin: '10px 0' }} />
          <button type="submit">Log In</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ padding: '1rem', background: '#f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <h1>Practice Management System</h1>
        <button onClick={() => signOut(auth)}>Sign Out</button>
      </header>
      <Dashboard />
    </div>
  );
}