import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);

  // Function to safely format dates to British format dd/MM/yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy');
    } catch (e) {
      return dateString;
    }
  };

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Patient Database</h2>
        <Link to="/">
          <button>+ Add New Patient</button>
        </Link>
      </div>

      <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '12px' }}>Full Name</th>
              <th style={{ padding: '12px' }}>DOB</th>
              <th style={{ padding: '12px' }}>Address</th>
              <th style={{ padding: '12px' }}>Test Date</th>
              <th style={{ padding: '12px' }}>Next Due</th>
              <th style={{ padding: '12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px', fontWeight: '500' }}>{patient.fullName}</td>
                <td style={{ padding: '12px' }}>{formatDate(patient.dob)}</td>
                <td style={{ padding: '12px' }}>{patient.address ? patient.address.split(',')[0] : '-'}</td>
                <td style={{ padding: '12px' }}>{formatDate(patient.sightTestDate)}</td>
                <td style={{ padding: '12px', color: '#0070f3', fontWeight: '500' }}>
                   {formatDate(patient.nextTestDate)}
                </td>
                <td style={{ padding: '12px' }}>
                  <Link to={`/patients/${patient.id}`}>
                    <button className="secondary" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>View Record</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}