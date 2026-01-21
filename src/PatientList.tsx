import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    const fetchPatients = async () => {
      const q = query(collection(db, "patients"), orderBy("fullName"));
      const snap = await getDocs(q);
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchPatients();
  }, []);

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2rem'}}>
        <h2>Patient Directory</h2>
        <Link to="/"><button>+ New Exam / Patient</button></Link>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        {patients.map(p => (
          <div key={p.id} style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{p.fullName}</div>
              <div style={{color:'#666', fontSize:'0.9rem'}}>DOB: {p.dob} | {p.address}</div>
              <div style={{fontSize:'0.8rem', color:'#999'}}>ID: {p.id}</div>
            </div>
            <Link to={`/patients/${p.id}`}>
              <button className="secondary">View History</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}