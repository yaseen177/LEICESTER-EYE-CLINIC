import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

// HELPER: Convert 2026-06-01 -> 01/06/2026
const toBritishDate = (isoDate: string) => {
  if (!isoDate) return '-';
  try { return format(parseISO(isoDate), 'dd/MM/yyyy'); } catch (e) { return isoDate; }
};

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    id: '', name: '', address: '', dob: '', dueStart: '', dueEnd: ''
  });

  const fetchPatients = async () => {
    try {
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      const loadedPatients = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

  useEffect(() => { fetchPatients(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete ${name}?`)) {
      await deleteDoc(doc(db, "patients", id));
      fetchPatients(); 
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchId = (p.displayId || '').includes(filters.id);
    const matchName = (p.fullName || '').toLowerCase().includes(filters.name.toLowerCase());
    const matchAddress = (p.address || '').toLowerCase().includes(filters.address.toLowerCase());
    const matchDob = (p.dob || '').includes(filters.dob);

    let matchDate = true;
    if (filters.dueStart) { if (!p.nextTestDate || p.nextTestDate < filters.dueStart) matchDate = false; }
    if (filters.dueEnd) { if (!p.nextTestDate || p.nextTestDate > filters.dueEnd) matchDate = false; }

    return matchId && matchName && matchAddress && matchDob && matchDate;
  });

  const resetFilters = () => {
    setFilters({ id: '', name: '', address: '', dob: '', dueStart: '', dueEnd: '' });
  };

  if (loading) return <div className="dashboard-container">Loading Database...</div>;

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem', alignItems:'center'}}>
        <h2>Patient Database</h2>
        <Link to="/"><button>+ New Patient</button></Link>
      </div>

      <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <strong>🔍 Filter Database</strong>
          <button onClick={resetFilters} style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#6b7280' }}>Reset Filters</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px' }}>
          <input type="text" placeholder="ID (e.g. 001)" value={filters.id} onChange={e => setFilters({...filters, id: e.target.value})} style={{padding: '8px'}} />
          <input type="text" placeholder="Name" value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} style={{padding: '8px'}} />
          <input type="text" placeholder="Address" value={filters.address} onChange={e => setFilters({...filters, address: e.target.value})} style={{padding: '8px'}} />
          <input type="text" placeholder="DOB (YYYY-MM-DD)" value={filters.dob} onChange={e => setFilters({...filters, dob: e.target.value})} style={{padding: '8px'}} />
        </div>

        <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
           <div style={{fontSize:'0.85rem', fontWeight:'bold', color:'#1e40af', marginBottom:'5px'}}>📞 Recall Manager: Filter by Next Due Date</div>
           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <label style={{margin:0, fontSize:'0.8rem'}}>From:</label>
             <input type="date" value={filters.dueStart} onChange={e => setFilters({...filters, dueStart: e.target.value})} style={{padding: '6px', border:'1px solid #ccc'}} />
             <label style={{margin:0, fontSize:'0.8rem'}}>To:</label>
             <input type="date" value={filters.dueEnd} onChange={e => setFilters({...filters, dueEnd: e.target.value})} style={{padding: '6px', border:'1px solid #ccc'}} />
           </div>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
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
                  {/* BRITISH DATE HERE */}
                  DOB: {toBritishDate(p.dob)} | {p.address}
                </div>
              </div>
              
              <div style={{ marginRight: '20px', textAlign: 'right' }}>
                 <div style={{fontSize:'0.75rem', color:'#666'}}>Next Due</div>
                 <div style={{fontWeight:'bold', color: p.nextTestDate < new Date().toISOString().split('T')[0] ? '#dc2626' : '#059669'}}>
                   {/* BRITISH DATE HERE */}
                   {toBritishDate(p.nextTestDate)}
                 </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Link to={`/patients/${p.id}`}><button className="secondary">View</button></Link>
                <button onClick={() => handleDelete(p.id, p.fullName)} style={{background:'#fee2e2', color:'#b91c1c', border:'1px solid #fca5a5'}}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}