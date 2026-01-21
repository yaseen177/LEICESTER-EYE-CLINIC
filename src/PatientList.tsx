import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // -- FILTER STATE --
  const [filters, setFilters] = useState({
    id: '',
    name: '',
    address: '',
    dob: ''
  });

  // -- 1. FETCH ALL PATIENTS --
  const fetchPatients = async () => {
    try {
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      
      const loadedPatients = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));

      // Default Sort: Newest ID first
      loadedPatients.sort((a: any, b: any) => {
        const idA = parseInt(a.displayId || "0");
        const idB = parseInt(b.displayId || "0");
        return idB - idA; 
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

  // -- 2. FILTER LOGIC --
  const filteredPatients = patients.filter(p => {
    const matchId = (p.displayId || '').includes(filters.id);
    const matchName = (p.fullName || '').toLowerCase().includes(filters.name.toLowerCase());
    const matchAddress = (p.address || '').toLowerCase().includes(filters.address.toLowerCase());
    const matchDob = (p.dob || '').includes(filters.dob);

    return matchId && matchName && matchAddress && matchDob;
  });

  const resetFilters = () => {
    setFilters({ id: '', name: '', address: '', dob: '' });
  };

  if (loading) return <div className="dashboard-container">Loading Database...</div>;

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem', alignItems:'center'}}>
        <h2>Patient Database</h2>
        <Link to="/"><button>+ New Patient</button></Link>
      </div>

      {/* --- FILTER BAR --- */}
      <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <strong>🔍 Filter Database</strong>
          <button onClick={resetFilters} style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#6b7280' }}>Reset Filters</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{fontSize:'0.8rem', color:'#666'}}>Patient ID</label>
            <input 
              type="text" 
              placeholder="e.g. 001" 
              value={filters.id}
              onChange={e => setFilters({...filters, id: e.target.value})}
              style={{padding: '8px', width: '100%'}}
            />
          </div>
          <div>
            <label style={{fontSize:'0.8rem', color:'#666'}}>Full Name</label>
            <input 
              type="text" 
              placeholder="Search Name..." 
              value={filters.name}
              onChange={e => setFilters({...filters, name: e.target.value})}
              style={{padding: '8px', width: '100%'}}
            />
          </div>
          <div>
            <label style={{fontSize:'0.8rem', color:'#666'}}>Address / Postcode</label>
            <input 
              type="text" 
              placeholder="Search Address..." 
              value={filters.address}
              onChange={e => setFilters({...filters, address: e.target.value})}
              style={{padding: '8px', width: '100%'}}
            />
          </div>
          <div>
            <label style={{fontSize:'0.8rem', color:'#666'}}>Date of Birth</label>
            <input 
              type="text" 
              placeholder="YYYY-MM-DD" 
              value={filters.dob}
              onChange={e => setFilters({...filters, dob: e.target.value})}
              style={{padding: '8px', width: '100%'}}
            />
          </div>
        </div>
      </div>

      {/* --- RESULTS TABLE --- */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        
        {/* Results Counter */}
        <div style={{ padding: '10px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem', color: '#666' }}>
          Showing {filteredPatients.length} records
        </div>

        {filteredPatients.length === 0 ? (
          <div style={{padding: '3rem', textAlign: 'center', color: '#9ca3af'}}>
            No patients match your filters.
          </div>
        ) : (
          filteredPatients.map(p => (
            <div key={p.id} style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{flex: 1}}>
                <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>
                  <span style={{color:'#0070f3', marginRight:'10px'}}>#{p.displayId || 'OLD'}</span>
                  {p.fullName}
                </div>
                <div style={{color:'#666', fontSize:'0.9rem'}}>
                  {p.dob} | {p.address}
                </div>
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