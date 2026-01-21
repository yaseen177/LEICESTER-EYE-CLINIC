import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { format, parseISO } from 'date-fns';

export default function PatientDetails() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Logic for Editing Prices
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");

  const fetchData = async () => {
    if (!id) return;
    const pSnap = await getDoc(doc(db, "patients", id));
    if (pSnap.exists()) {
      setPatient(pSnap.data());
      
      const q = query(collection(db, "records"), where("patientId", "==", id));
      const rSnap = await getDocs(q);
      const sortedRecords = rSnap.docs
        .map(d => ({ rid: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(b.sightTestDate).getTime() - new Date(a.sightTestDate).getTime());
      
      setRecords(sortedRecords);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  // -- SECURITY PIN LOGIC --
  const handleUnlockPrice = (recordId: string, currentPrice: string) => {
    const pin = prompt("Enter Security PIN to modify price:");
    if (pin === "1812") {
      setEditingPriceId(recordId);
      setTempPrice(currentPrice);
    } else {
      alert("Incorrect PIN");
    }
  };

  const saveNewPrice = async (recordId: string) => {
    await updateDoc(doc(db, "records", recordId), {
      "payment.amount": tempPrice
    });
    setEditingPriceId(null);
    fetchData(); // Refresh UI
  };

  const deleteRecord = async (recordId: string) => {
    if(confirm("Delete this specific clinical record?")) {
      await deleteDoc(doc(db, "records", recordId));
      fetchData();
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="dashboard-container">
      <Link to="/patients" style={{textDecoration:'none', color:'#666'}}>← Back to Database</Link>
      
      {/* HEADER */}
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{margin:0, color:'#0070f3'}}>
            <span style={{color:'#999', fontSize:'0.7em', marginRight:'10px'}}>#{patient.displayId}</span>
            {patient.fullName}
          </h1>
          <p>{patient.address}</p>
        </div>
        <div style={{textAlign:'right'}}>
           <strong>DOB:</strong> {patient.dob}
        </div>
      </div>

      <h2 style={{marginTop:'2rem'}}>Clinical History</h2>

      {records.map((rec) => (
        <div key={rec.rid} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          
          <div style={{ background: '#f3f4f6', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd' }}>
             <strong>Date: {format(parseISO(rec.sightTestDate), 'dd/MM/yyyy')}</strong>
             <button onClick={() => deleteRecord(rec.rid)} style={{background:'transparent', color:'red', border:'none', fontSize:'0.8rem', cursor:'pointer'}}>Delete Record</button>
          </div>

          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{marginTop:0}}>Rx & Clinical</h4>
              <div style={{fontSize:'0.9rem', background:'#fafafa', padding:'10px', borderRadius:'4px'}}>
                RE: {rec.rx?.right?.sph} / {rec.rx?.right?.cyl} x {rec.rx?.right?.axis} (Add {rec.rx?.right?.add})<br/>
                LE: {rec.rx?.left?.sph} / {rec.rx?.left?.cyl} x {rec.rx?.left?.axis} (Add {rec.rx?.left?.add})
              </div>
              <p style={{marginTop:'10px', fontStyle:'italic', color:'#555'}}>"{rec.recommendations}"</p>
            </div>

            <div>
              <h4 style={{marginTop:0}}>Dispense</h4>
              <p>
                <strong>{rec.dispense?.category}</strong> - {rec.dispense?.type}<br/>
                <span style={{color:'#666'}}>{rec.dispense?.lensName}</span>
              </p>

              {/* SECURE PRICE EDITING */}
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                <div style={{fontSize:'0.8rem', color:'#1e40af'}}>Total Paid ({rec.payment?.method})</div>
                
                {editingPriceId === rec.rid ? (
                  <div style={{display:'flex', gap:'5px', marginTop:'5px'}}>
                    <input 
                      type="number" 
                      value={tempPrice} 
                      onChange={e => setTempPrice(e.target.value)} 
                      style={{width:'100px', padding:'5px'}} 
                    />
                    <button onClick={() => saveNewPrice(rec.rid)} style={{padding:'5px'}}>Save</button>
                  </div>
                ) : (
                  <div style={{fontSize:'1.2rem', fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
                    £{rec.payment?.amount}
                    <button 
                      onClick={() => handleUnlockPrice(rec.rid, rec.payment?.amount)} 
                      title="Unlock to Edit"
                      style={{background:'none', border:'none', cursor:'pointer', fontSize:'1rem'}}
                    >
                      🔒
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}