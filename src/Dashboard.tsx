import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Define libraries outside component to prevent re-renders
const libraries: ("places")[] = ['places'];

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, reset } = useForm<any>();
  
  // -- 1. GOOGLE MAPS SETUP --
  const { isLoaded } = useLoadScript({
    // PASTE YOUR API KEY BELOW INSIDE THE QUOTES
    googleMapsApiKey: "AIzaSyD125XzyEADr4osaI-GJhO0sXha8-sfg5A", 
    libraries,
  });
  
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setValue("address", place.formatted_address); 
      }
    }
  };

  // -- 2. PATIENT LIST STATE (For the Table) --
  const [patients, setPatients] = useState<any[]>([]);

  // Fetch patients in real-time
  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(patientsData);
    });
    return () => unsubscribe();
  }, []);

  // -- 3. RECALL DATE LOGIC --
  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");

  useEffect(() => {
    if (sightTestDate && recallMonths) {
      const nextDate = addMonths(new Date(sightTestDate), parseInt(recallMonths));
      setValue("nextTestDate", format(nextDate, 'yyyy-MM-dd'));
    }
  }, [sightTestDate, recallMonths, setValue]);

  // -- 4. SAVE TO FIREBASE --
  const onSubmit = async (data: any) => {
    try {
      await addDoc(collection(db, "patients"), {
        ...data,
        createdAt: new Date()
      });
      alert("Patient Record Saved!");
      reset(); // Clear form
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Error saving record. Check console.");
    }
  };

  // -- 5. REPORT GENERATION --
  const generateReport = () => {
    const doc = new jsPDF();
    doc.text("Daily Management Report", 14, 20);
    
    // Example data - in future you can replace this with real data from 'patients'
    const tableData = [
      ["John Doe", "Varifocal", "£250.00", "Card"],
      ["Jane Smith", "Single Vision", "£60.00", "Cash"],
      ["Bob Jones", "Bifocal", "£120.00", "Card"],
    ];

    // @ts-ignore
    doc.autoTable({
      head: [['Patient', 'Lens Type', 'Amount', 'Method']],
      body: tableData,
      startY: 30,
    });

    // @ts-ignore
    doc.text("Total Takings: £430.00", 14, doc.lastAutoTable.finalY + 10);
    
    const pdfBlob = doc.output('bloburl');
    window.open(pdfBlob, '_blank');
  };

  if (!isLoaded) return <div style={{padding: '2rem'}}>Loading System Maps...</div>;

  return (
    <div className="dashboard-container">
      
      {/* HEADER ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px' }}>
        <h3 style={{ margin: 0, color: '#3730a3' }}>Clinical Dashboard</h3>
        <button onClick={generateReport}>Generate Daily Report (PDF)</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        
        {/* SECTION 1: DETAILS */}
        <h2>1. Patient Details</h2>
        <div className="grid-form">
          <div>
             <label>Full Name</label>
             <input {...register("fullName")} placeholder="e.g. John Doe" required />
          </div>
          <div>
             <label>Date of Birth</label>
             <input type="date" {...register("dob")} required />
          </div>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Address Lookup</label>
            <Autocomplete
              onLoad={(auto) => setAutocomplete(auto)}
              onPlaceChanged={onPlaceChanged}
            >
               <input type="text" placeholder="Start typing postcode or address..." />
            </Autocomplete>
            {/* Hidden field that actually stores the address string */}
            <input type="hidden" {...register("address")} />
          </div>
        </div>

        {/* SECTION 2: CLINICAL RX */}
        <h2>2. Clinical Rx</h2>
        <div className="rx-grid">
          {/* Header Row */}
          <span></span>
          <span className="rx-header">Sph</span>
          <span className="rx-header">Cyl</span>
          <span className="rx-header">Axis</span>
          <span className="rx-header">Add</span>

          {/* Right Eye */}
          <strong>RE</strong>
          <input {...register("rx.right.sph")} placeholder="+0.00" />
          <input {...register("rx.right.cyl")} placeholder="-0.00" />
          <input {...register("rx.right.axis")} placeholder="000" />
          <input {...register("rx.right.add")} placeholder="+2.00" />
          
          {/* Left Eye */}
          <strong>LE</strong>
          <input {...register("rx.left.sph")} placeholder="+0.00" />
          <input {...register("rx.left.cyl")} placeholder="-0.00" />
          <input {...register("rx.left.axis")} placeholder="000" />
          <input {...register("rx.left.add")} placeholder="+2.00" />
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
          <div style={{ flex: 1 }}>
            <label>Intermediate Add</label>
            <input {...register("rx.interAdd")} placeholder="+1.00" />
          </div>
          <div style={{ flex: 1 }}>
            <label>BVD (mm)</label>
            <input {...register("rx.bvd")} placeholder="12" />
          </div>
        </div>

        {/* SECTION 3: RECALL */}
        <h2>3. Recall & Recommendations</h2>
        <label>Clinical Notes</label>
        <textarea {...register("recommendations")} rows={3} placeholder="Enter clinical recommendations here..." />
        
        <div className="grid-form" style={{ marginTop: '1rem' }}>
          <div>
            <label>Sight Test Date</label>
            <input type="date" {...register("sightTestDate")} required />
          </div>
          <div>
            <label>Recall Period</label>
            <select {...register("recallPeriod")} required>
              <option value="12">12 Months</option>
              <option value="24">24 Months</option>
              <option value="6">6 Months</option>
              <option value="3">3 Months</option>
              <option value="9">9 Months</option>
              <option value="18">18 Months</option>
            </select>
          </div>
          <div>
            <label>Next Due Date</label>
            <input {...register("nextTestDate")} readOnly style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
          </div>
        </div>

        {/* SECTION 4: DISPENSING */}
        <h2>4. Dispensing</h2>
        <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div className="grid-form">
            <div>
              <label>Lens Type</label>
              <select {...register("dispense.type")}>
                <option value="SVd">Single Vision Distance</option>
                <option value="Varifocal">Varifocal</option>
                <option value="Bifocal">Bifocal</option>
                <option value="SVn">Reading / Near</option>
              </select>
            </div>
            <div>
              <label>Lens Product Name</label>
              <input {...register("dispense.lensName")} placeholder="e.g. Varilux Comfort Max" />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '1rem' }}>
            <div><label>PD</label><input {...register("dispense.pd")} /></div>
            <div><label>Heights</label><input {...register("dispense.heights")} /></div>
            <div><label>Panto</label><input {...register("dispense.panto")} /></div>
            <div><label>Bow</label><input {...register("dispense.bow")} /></div>
          </div>
        </div>

        {/* SECTION 5: PAYMENT */}
        <h2>5. Payment</h2>
        <div className="grid-form" style={{ alignItems: 'end' }}>
          <div>
            <label>Total Amount (£)</label>
            <input {...register("payment.amount")} type="number" step="0.01" />
          </div>
          <div>
            <label>Method</label>
            <select {...register("payment.method")}>
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="BACS">BACS</option>
            </select>
          </div>
          <div>
             <label>Discount Code</label>
             <input {...register("payment.discount")} />
          </div>
        </div>

        <button type="submit" style={{ marginTop: '2rem', width: '100%', fontSize: '1.1rem' }}>
          Save Patient Record
        </button>
      </form>

      {/* ------------------------------------------- */}
      {/* PATIENT RECORDS TABLE (EXCEL STYLE)         */}
      {/* ------------------------------------------- */}
      <div style={{ marginTop: '4rem', borderTop: '2px solid #e5e7eb', paddingTop: '2rem' }}>
        <h2 style={{ borderBottom: 'none', marginBottom: '1rem' }}>Patient Database</h2>
        
        <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>Full Name</th>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>DOB</th>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>Address</th>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>Test Date</th>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>Next Due</th>
                <th style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>Recall</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                    No records found. Add a patient above to see them here.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{patient.fullName}</td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{patient.dob}</td>
                    <td style={{ padding: '12px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#6b7280' }}>
                      {patient.address}
                    </td>
                    <td style={{ padding: '12px' }}>{patient.sightTestDate}</td>
                    <td style={{ padding: '12px', color: '#0070f3', fontWeight: '500' }}>{patient.nextTestDate}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        background: '#eff6ff', 
                        color: '#1e40af', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {patient.recallPeriod} Mths
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}