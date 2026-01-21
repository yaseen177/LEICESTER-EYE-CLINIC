import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore'; // Removed 'orderBy'
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatients = async () => {
    try {
      // 1. Get ALL patients (Unsorted to ensure we don't hide old records)
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      
      const loadedPatients = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));

      // 2. Sort them here in the browser (Safe way)
      // If a patient has no ID, we treat it as "000" so it goes to the bottom
      loadedPatients.sort((a: any, b: any) => {
        const idA = parseInt(a.displayId || "0");
        const idB = parseInt(b.displayId || "0");
        return idB - idA; // Descending order (Newest ID first)
      });

      setPatients(loadedPatients);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) {
      await deleteDoc(doc(db, "patients", id));
      fetchPatients(); 
    }
  };

  if (loading) return <div className="dashboard-container">Loading Database...</div>;

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2rem'}}>
        <h2>Patient Database</h2>
        <Link to="/"><button>+ New Patient</button></Link>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        {patients.length === 0 ? (
          <div style={{padding: '2rem', textAlign: 'center', color: '#666'}}>
            No patients found. 
          </div>
        ) : (
          patients.map(p => (
            <div key={p.id} style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{flex: 1}}>
                <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>
                  {/* If they have no ID, show "OLD" */}
                  <span style={{color:'#0070f3', marginRight:'10px'}}>#{p.displayId || 'OLD'}</span>
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
          ))
        )}
      </div>
    </div>
  );
}