import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const libraries: ("places")[] = ['places'];

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, reset, getValues } = useForm<any>();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);

  // -- GOOGLE MAPS --
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY", // <--- PASTE KEY HERE
    libraries,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // -- LOAD PATIENTS FOR SEARCH --
  useEffect(() => {
    const loadPatients = async () => {
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      setAllPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadPatients();
  }, []);

  // -- SEARCH LOGIC --
  useEffect(() => {
    if (searchTerm.length > 1) {
      const results = allPatients.filter(p => 
        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPatients(results);
    } else {
      setFilteredPatients([]);
    }
  }, [searchTerm, allPatients]);

  const selectPatient = (patient: any) => {
    setExistingId(patient.id);
    setValue("fullName", patient.fullName);
    setValue("dob", patient.dob);
    setValue("address", patient.address);
    setSearchTerm('');
    setFilteredPatients([]);
  };

  const clearForm = () => {
    reset();
    setExistingId(null);
    setSearchTerm('');
  };

  // -- RECALL LOGIC --
  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");
  useEffect(() => {
    if (sightTestDate && recallMonths) {
      const nextDate = addMonths(new Date(sightTestDate), parseInt(recallMonths));
      setValue("nextTestDate", format(nextDate, 'yyyy-MM-dd'));
    }
  }, [sightTestDate, recallMonths, setValue]);

  // -- SUBMIT LOGIC (HANDLES BOTH NEW & EXISTING) --
  const onSubmit = async (data: any) => {
    try {
      let patientId = existingId;

      // 1. If it's a NEW patient, create them in the 'patients' collection first
      if (!patientId) {
        const patientRef = await addDoc(collection(db, "patients"), {
          fullName: data.fullName,
          dob: data.dob,
          address: data.address,
          createdAt: new Date().toISOString()
        });
        patientId = patientRef.id;
      }

      // 2. Add the CLINICAL RECORD to the 'records' collection
      await addDoc(collection(db, "records"), {
        patientId: patientId, // Links this record to the patient
        sightTestDate: data.sightTestDate,
        nextTestDate: data.nextTestDate,
        recallPeriod: data.recallPeriod,
        rx: data.rx,
        recommendations: data.recommendations,
        dispense: data.dispense,
        payment: data.payment,
        createdAt: new Date().toISOString()
      });

      alert(`Record Saved! (Patient ID: ${patientId})`);
      clearForm();
      // Reload patients in case a new one was added
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      setAllPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) {
      console.error("Error: ", e);
      alert("Error saving record.");
    }
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="dashboard-container">
      
      {/* --- SEARCH BAR --- */}
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="🔍 Search existing patient by Name or Address..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: '2px solid #0070f3' }}
          />
          <button onClick={clearForm} className="secondary">Clear / New</button>
        </div>
        
        {/* DROPDOWN RESULTS */}
        {filteredPatients.length > 0 && (
          <div style={{ position: 'absolute', top: '50px', left: 0, right: 0, background: 'white', border: '1px solid #ccc', zIndex: 100, borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {filteredPatients.map(p => (
              <div 
                key={p.id} 
                onClick={() => selectPatient(p)}
                style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <strong>{p.fullName}</strong>
                <span style={{color:'#666'}}>{p.address} (Born: {p.dob})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* DETAILS SECTION */}
        <h2>1. Patient Details {existingId && <span style={{fontSize:'0.8rem', color:'green'}}> (✓ Existing ID: {existingId})</span>}</h2>
        <div className="grid-form">
          <div>
            <label>Full Name</label>
            <input {...register("fullName")} disabled={!!existingId} style={existingId ? {background:'#e5e7eb', color:'#6b7280'} : {}} required />
          </div>
          <div>
            <label>Date of Birth</label>
            <input type="date" {...register("dob")} disabled={!!existingId} style={existingId ? {background:'#e5e7eb', color:'#6b7280'} : {}} required />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            {!existingId ? (
              <Autocomplete onLoad={(auto) => setAutocomplete(auto)} onPlaceChanged={() => {
                 if(autocomplete) setValue("address", autocomplete.getPlace().formatted_address);
              }}>
                 <input type="text" placeholder="Postcode search..." />
              </Autocomplete>
            ) : null}
            <input {...register("address")} readOnly={!!existingId} style={existingId ? {background:'#e5e7eb', color:'#6b7280'} : {}} />
          </div>
        </div>

        {/* --- CLINICAL SECTIONS (UNCHANGED) --- */}
        <h2>2. Clinical Rx</h2>
        <div className="rx-grid">
          <span></span><span className="rx-header">Sph</span><span className="rx-header">Cyl</span><span className="rx-header">Axis</span><span className="rx-header">Add</span>
          <strong>RE</strong>
          <input {...register("rx.right.sph")} /><input {...register("rx.right.cyl")} /><input {...register("rx.right.axis")} /><input {...register("rx.right.add")} />
          <strong>LE</strong>
          <input {...register("rx.left.sph")} /><input {...register("rx.left.cyl")} /><input {...register("rx.left.axis")} /><input {...register("rx.left.add")} />
        </div>
        
        {/* RECALL */}
        <h2>3. Recall</h2>
        <div className="grid-form">
          <input type="date" {...register("sightTestDate")} required />
          <select {...register("recallPeriod")} required>
            <option value="12">12 Months</option>
            <option value="24">24 Months</option>
            <option value="6">6 Months</option>
          </select>
          <input {...register("nextTestDate")} readOnly />
        </div>

        {/* DISPENSE & PAYMENT */}
        <h2>4. Dispense & Payment</h2>
        <div className="grid-form">
            <select {...register("dispense.type")}><option value="SVd">SV Distance</option><option value="Varifocal">Varifocal</option></select>
            <input {...register("payment.amount")} placeholder="Amount £" type="number" step="0.01" />
        </div>

        <button type="submit" style={{ marginTop: '2rem', width: '100%' }}>Save Clinical Record</button>
      </form>
    </div>
  );
}