import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase.ts';
import { format, parseISO } from 'date-fns';

export default function PatientDetails() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      // 1. Get Patient Demographics
      const pSnap = await getDoc(doc(db, "patients", id));
      if (pSnap.exists()) {
        setPatient(pSnap.data());
        
        // 2. Get All Clinical Records for this Patient
        const q = query(collection(db, "records"), where("patientId", "==", id));
        const rSnap = await getDocs(q);
        
        // Sort records by date (Client-side sort is easier for small history)
        const sortedRecords = rSnap.docs
          .map(d => ({ rid: d.id, ...d.data() }))
          .sort((a: any, b: any) => new Date(b.sightTestDate).getTime() - new Date(a.sightTestDate).getTime());
          
        setRecords(sortedRecords);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="dashboard-container">
      <Link to="/patients" style={{textDecoration:'none', color:'#666'}}>← Back to Directory</Link>
      
      {/* STATIC HEADER */}
      <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1rem', marginTop: '1rem' }}>
        <h1 style={{margin:0, color:'#0070f3'}}>{patient.fullName}</h1>
        <p><strong>ID:</strong> {id} | <strong>DOB:</strong> {patient.dob}</p>
        <p style={{color:'#666'}}>{patient.address}</p>
      </div>

      <h2 style={{marginTop:'2rem'}}>Clinical History ({records.length} Records)</h2>
      
      {records.length === 0 && <p>No exams recorded yet.</p>}

      {records.map((rec) => (
        <div key={rec.rid} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          
          {/* RECORD HEADER */}
          <div style={{ background: '#f3f4f6', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd' }}>
            <strong>Test Date: {format(parseISO(rec.sightTestDate), 'dd/MM/yyyy')}</strong>
            <span style={{color: '#0070f3'}}>Next Due: {format(parseISO(rec.nextTestDate), 'dd/MM/yyyy')}</span>
          </div>

          {/* RECORD BODY */}
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{marginTop:0}}>Rx</h4>
              <div style={{fontSize:'0.9rem', background:'#fafafa', padding:'10px', borderRadius:'4px'}}>
                <div>RE: {rec.rx?.right?.sph} / {rec.rx?.right?.cyl} x {rec.rx?.right?.axis} (Add {rec.rx?.right?.add})</div>
                <div>LE: {rec.rx?.left?.sph} / {rec.rx?.left?.cyl} x {rec.rx?.left?.axis} (Add {rec.rx?.left?.add})</div>
              </div>
            </div>
            <div>
              <h4 style={{marginTop:0}}>Dispense & Pay</h4>
              <p style={{fontSize:'0.9rem'}}>
                Lens: {rec.dispense?.type}<br/>
                Paid: £{rec.payment?.amount} ({rec.payment?.method})
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}