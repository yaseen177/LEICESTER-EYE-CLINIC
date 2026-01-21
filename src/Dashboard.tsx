import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

const libraries: ("places")[] = ['places'];

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, reset } = useForm<any>();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);

  // -- 1. GOOGLE MAPS SETUP --
  const { isLoaded } = useLoadScript({
    // 👇👇👇 PASTE YOUR REAL API KEY HERE OR MAPS WILL FAIL 👇👇👇
    googleMapsApiKey: "AIzaSyD125XzyEADr4osaI-GJhO0sXha8-sfg5A", 
    libraries,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // -- LOAD PATIENTS FOR SEARCH --
  useEffect(() => {
    const loadPatients = async () => {
      const q = query(collection(db, "patients"), orderBy("fullName"));
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

  // -- SUBMIT LOGIC (FIXED TO PREVENT CRASHES) --
  const onSubmit = async (data: any) => {
    try {
      let patientId = existingId;

      // 1. If it's a NEW patient, create them in the 'patients' collection first
      if (!patientId) {
        const patientRef = await addDoc(collection(db, "patients"), {
          fullName: data.fullName,
          dob: data.dob,
          address: data.address || "", // Default to empty string if missing
          createdAt: new Date().toISOString()
        });
        patientId = patientRef.id;
      }

      // 2. Add the CLINICAL RECORD (Sanitized Data)
      // We use "|| ''" to ensure no 'undefined' values are sent to Firebase
      await addDoc(collection(db, "records"), {
        patientId: patientId, 
        sightTestDate: data.sightTestDate || format(new Date(), 'yyyy-MM-dd'),
        nextTestDate: data.nextTestDate || "",
        recallPeriod: data.recallPeriod || "12",
        
        // Rx Data (Safe Defaults)
        rx: {
          right: { 
            sph: data.rx?.right?.sph || "", 
            cyl: data.rx?.right?.cyl || "", 
            axis: data.rx?.right?.axis || "", 
            add: data.rx?.right?.add || "" 
          },
          left: { 
            sph: data.rx?.left?.sph || "", 
            cyl: data.rx?.left?.cyl || "", 
            axis: data.rx?.left?.axis || "", 
            add: data.rx?.left?.add || "" 
          },
          bvd: data.rx?.bvd || "",
          interAdd: data.rx?.interAdd || ""
        },

        recommendations: data.recommendations || "None", // Fixes the crash
        
        // Dispense Data (Safe Defaults)
        dispense: {
          type: data.dispense?.type || "SVd",
          lensName: data.dispense?.lensName || "",
          pd: data.dispense?.pd || "",
          heights: data.dispense?.heights || "",
          panto: data.dispense?.panto || "",
          bow: data.dispense?.bow || ""
        },

        // Payment Data
        payment: {
          amount: data.payment?.amount || "0",
          method: data.payment?.method || "Card",
          discount: data.payment?.discount || ""
        },

        createdAt: new Date().toISOString()
      });

      alert(`Record Saved! (Patient ID: ${patientId})`);
      clearForm();
      
      // Reload patients
      const q = query(collection(db, "patients"), orderBy("fullName"));
      const snap = await getDocs(q);
      setAllPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (e) {
      console.error("Error: ", e);
      alert("Error saving record. Check console for details.");
    }
  };

  if (!isLoaded) return <div>Loading Maps... (If stuck, check API Key)</div>;

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

        {/* --- CLINICAL SECTIONS --- */}
        <h2>2. Clinical Rx</h2>
        <div className="rx-grid">
          <span></span><span className="rx-header">Sph</span><span className="rx-header">Cyl</span><span className="rx-header">Axis</span><span className="rx-header">Add</span>
          <strong>RE</strong>
          <input {...register("rx.right.sph")} /><input {...register("rx.right.cyl")} /><input {...register("rx.right.axis")} /><input {...register("rx.right.add")} />
          <strong>LE</strong>
          <input {...register("rx.left.sph")} /><input {...register("rx.left.cyl")} /><input {...register("rx.left.axis")} /><input {...register("rx.left.add")} />
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

        {/* RECALL */}
        <h2>3. Recall</h2>
        <label>Clinical Recommendations</label>
        <textarea {...register("recommendations")} rows={2} placeholder="Notes..." style={{marginBottom:'1rem'}} />

        <div className="grid-form">
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
            </select>
          </div>
          <div>
            <label>Next Due Date</label>
            <input {...register("nextTestDate")} readOnly style={{background:'#f3f4f6'}} />
          </div>
        </div>

        {/* DISPENSE & PAYMENT */}
        <h2>4. Dispense & Payment</h2>
        <div className="grid-form">
            <div>
              <label>Lens Type</label>
              <select {...register("dispense.type")}><option value="SVd">SV Distance</option><option value="Varifocal">Varifocal</option></select>
            </div>
            <div>
              <label>Amount £</label>
              <input {...register("payment.amount")} type="number" step="0.01" />
            </div>
        </div>

        <button type="submit" style={{ marginTop: '2rem', width: '100%' }}>Save Clinical Record</button>
      </form>
    </div>
  );
}