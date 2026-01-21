import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);

  const fetchPatients = async () => {
    // Sort by Display ID so 002 comes after 001
    const q = query(collection(db, "patients"), orderBy("displayId", "desc"));
    const snap = await getDocs(q);
    setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) {
      await deleteDoc(doc(db, "patients", id));
      fetchPatients(); // Refresh list
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2rem'}}>
        <h2>Patient Database</h2>
        <Link to="/"><button>+ New Patient</button></Link>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        {patients.map(p => (
          <div key={p.id} style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{flex: 1}}>
              <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>
                <span style={{color:'#0070f3', marginRight:'10px'}}>#{p.displayId || '---'}</span>
                {p.fullName}
              </div>
              <div style={{color:'#666', fontSize:'0.9rem'}}>{p.address}</div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to={`/patients/${p.id}`}>
                <button className="secondary">View</button>
              </Link>
              <button 
                onClick={() => handleDelete(p.id, p.fullName)} 
                style={{background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5'}}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}