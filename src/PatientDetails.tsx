import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { format, parseISO } from 'date-fns';

export default function PatientDetails() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatient = async () => {
      if (id) {
        const docRef = doc(db, "patients", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPatient(docSnap.data());
        }
      }
      setLoading(false);
    };
    fetchPatient();
  }, [id]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return format(parseISO(dateString), 'dd/MM/yyyy');
  };

  if (loading) return <div style={{padding:'2rem'}}>Loading Record...</div>;
  if (!patient) return <div style={{padding:'2rem'}}>Patient not found.</div>;

  return (
    <div className="dashboard-container">
      <Link to="/patients" style={{ display: 'inline-block', marginBottom: '1rem', color: '#666', textDecoration: 'none' }}>
        ← Back to Database
      </Link>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '2px solid #e5e7eb', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0070f3' }}>{patient.fullName}</h1>
          <p style={{ color: '#666' }}>{patient.address}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>DOB:</strong> {formatDate(patient.dob)}<br/>
          <strong>Next Due:</strong> <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{formatDate(patient.nextTestDate)}</span>
        </div>
      </div>

      {/* READ ONLY DISPLAY OF DATA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* LEFT COLUMN */}
        <div>
          <h3>Clinical Rx</h3>
          <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
            <p><strong>RE:</strong> {patient.rx?.right?.sph} / {patient.rx?.right?.cyl} x {patient.rx?.right?.axis} (Add {patient.rx?.right?.add})</p>
            <p><strong>LE:</strong> {patient.rx?.left?.sph} / {patient.rx?.left?.cyl} x {patient.rx?.left?.axis} (Add {patient.rx?.left?.add})</p>
            <p style={{marginTop: '10px', fontSize:'0.9rem'}}><strong>BVD:</strong> {patient.rx?.bvd}mm | <strong>Inter Add:</strong> {patient.rx?.interAdd}</p>
          </div>

          <h3 style={{ marginTop: '2rem' }}>History & Recall</h3>
          <p><strong>Last Test:</strong> {formatDate(patient.sightTestDate)}</p>
          <p><strong>Recall Period:</strong> {patient.recallPeriod} Months</p>
          <div style={{ marginTop: '1rem', background: '#fffbeb', padding: '1rem', border: '1px solid #fcd34d', borderRadius: '8px' }}>
            <strong>Recommendations:</strong>
            <p>{patient.recommendations}</p>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <h3>Dispensing Record</h3>
          <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
            <p><strong>Lens:</strong> {patient.dispense?.type} ({patient.dispense?.lensName})</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', fontSize: '0.9rem' }}>
              <div>PD: {patient.dispense?.pd}</div>
              <div>Heights: {patient.dispense?.heights}</div>
              <div>Panto: {patient.dispense?.panto}</div>
              <div>Bow: {patient.dispense?.bow}</div>
            </div>
          </div>

          <h3 style={{ marginTop: '2rem' }}>Transaction</h3>
          <p><strong>Total:</strong> £{patient.payment?.amount}</p>
          <p><strong>Method:</strong> {patient.payment?.method}</p>
          <p><strong>Discount:</strong> {patient.payment?.discount || 'None'}</p>
        </div>
      </div>
    </div>
  );
}