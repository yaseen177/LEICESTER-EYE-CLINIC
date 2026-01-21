import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <--- CHANGED IMPORT

const libraries: ("places")[] = ['places'];

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, reset } = useForm<any>();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);

  // -- 1. GOOGLE MAPS (UK RESTRICTED) --
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "AIzaSyD125XzyEADr4osaI-GJhO0sXha8-sfg5A", // <--- ENSURE KEY IS HERE
    libraries,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // -- LOAD PATIENTS --
  useEffect(() => {
    const loadPatients = async () => {
      // Safe load without orderBy first to prevent permission errors
      const q = query(collection(db, "patients"));
      const snap = await getDocs(q);
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllPatients(loaded);
    };
    loadPatients();
  }, []);

  // -- SEARCH --
  useEffect(() => {
    if (searchTerm.length > 1) {
      const lower = searchTerm.toLowerCase();
      const results = allPatients.filter(p => 
        (p.fullName && p.fullName.toLowerCase().includes(lower)) || 
        (p.displayId && String(p.displayId).includes(lower))
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

  // -- LOGIC: DISPENSE CATEGORIES --
  const dispenseCategory = watch("dispense.category");

  // -- LOGIC: RECALL DATES --
  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");
  useEffect(() => {
    if (sightTestDate && recallMonths) {
      const nextDate = addMonths(new Date(sightTestDate), parseInt(recallMonths));
      setValue("nextTestDate", format(nextDate, 'yyyy-MM-dd'));
    }
  }, [sightTestDate, recallMonths, setValue]);

  // -- SUBMIT --
  const onSubmit = async (data: any) => {
    try {
      let patientId = existingId;
      let displayId = "";

      // 1. New Patient Creation (with Numeric ID)
      if (!patientId) {
        // Find last ID to increment safely
        let newIdNumber = 1;
        const ids = allPatients
          .map(p => parseInt(p.displayId || "0"))
          .sort((a, b) => b - a); // Sort descending
        
        if (ids.length > 0) {
           newIdNumber = ids[0] + 1;
        }
        
        // Format as 001, 002 etc.
        displayId = String(newIdNumber).padStart(3, '0');

        const patientRef = await addDoc(collection(db, "patients"), {
          fullName: data.fullName,
          dob: data.dob,
          address: data.address || "", 
          displayId: displayId,
          createdAt: new Date().toISOString()
        });
        patientId = patientRef.id;
      }

      // 2. Add Record
      await addDoc(collection(db, "records"), {
        patientId: patientId, 
        sightTestDate: data.sightTestDate || format(new Date(), 'yyyy-MM-dd'),
        nextTestDate: data.nextTestDate || "",
        recallPeriod: data.recallPeriod,
        rx: data.rx || {},
        recommendations: data.recommendations || "None",
        dispense: {
          category: data.dispense?.category || "Other",
          type: data.dispense?.type || "Other",
          lensName: data.dispense?.lensName || "",
          pd: data.dispense?.pd || "",
          heights: data.dispense?.heights || "",
          panto: data.dispense?.panto || "",
          bow: data.dispense?.bow || ""
        },
        payment: {
          amount: data.payment?.amount || "0",
          method: data.payment?.method || "Card",
          discount: data.payment?.discount || ""
        },
        createdAt: new Date().toISOString()
      });

      alert(`Record Saved!`);
      clearForm();
      window.location.reload(); 

    } catch (e) {
      console.error(e);
      alert("Error saving record.");
    }
  };

  // -- REPORT GENERATOR (FIXED) --
  const generateDailyReport = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    // Find records created today
    const q = query(collection(db, "records")); 
    const snap = await getDocs(q);
    const todayRecords = snap.docs
      .map(d => d.data())
      .filter((d:any) => d.createdAt && d.createdAt.startsWith(todayStr));

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Daily Takings Report: ${todayStr}`, 14, 20);
    
    const tableData = todayRecords.map((rec:any) => [
      rec.dispense?.category || '-',
      rec.dispense?.type || '-',
      rec.payment?.method || '-',
      `£${rec.payment?.amount || '0'}`
    ]);

    let total = todayRecords.reduce((sum:number, r:any) => sum + parseFloat(r.payment?.amount || 0), 0);

    // FIX: Explicitly pass 'doc' to autoTable
    autoTable(doc, {
      head: [['Category', 'Type', 'Method', 'Amount']],
      body: tableData,
      startY: 30,
    });

    // @ts-ignore
    doc.text(`Total Revenue: £${total.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 10);
    window.open(doc.output('bloburl'), '_blank');
  };

  if (!isLoaded) return <div>Loading System...</div>;

  return (
    <div className="dashboard-container">
      
      {/* SEARCH BAR */}
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Search Patient (Name or ID)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: '2px solid #0070f3' }}
          />
          <button onClick={clearForm} className="secondary">Clear / New</button>
          <button onClick={generateDailyReport} style={{background:'#059669'}}>📊 Daily Report</button>
        </div>
        {filteredPatients.length > 0 && (
          <div style={{ position: 'absolute', top: '50px', width: '100%', background: 'white', border: '1px solid #ccc', zIndex: 100, borderRadius: '8px' }}>
            {filteredPatients.map(p => (
              <div key={p.id} onClick={() => selectPatient(p)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                <strong>#{p.displayId} - {p.fullName}</strong> ({p.address})
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* 1. DETAILS */}
        <h2>1. Patient Details {existingId && <span style={{color:'green'}}>(Existing Record)</span>}</h2>
        <div className="grid-form">
          <input {...register("fullName")} placeholder="Full Name" disabled={!!existingId} required />
          <input type="date" {...register("dob")} disabled={!!existingId} required />
          <div style={{ gridColumn: '1 / -1' }}>
            {!existingId && (
              <Autocomplete 
                onLoad={setAutocomplete} 
                onPlaceChanged={() => { if(autocomplete) setValue("address", autocomplete.getPlace().formatted_address); }}
                options={{ componentRestrictions: { country: "gb" } }} // UK ONLY
              >
                 <input type="text" placeholder="Address Lookup (UK Only)..." />
              </Autocomplete>
            )}
            <input {...register("address")} readOnly={!!existingId} placeholder="Address" />
          </div>
        </div>

        {/* 2. CLINICAL */}
        <h2>2. Clinical Rx</h2>
        <div className="rx-grid">
          <span></span><span className="rx-header">Sph</span><span className="rx-header">Cyl</span><span className="rx-header">Axis</span><span className="rx-header">Add</span>
          <strong>RE</strong>
          <input {...register("rx.right.sph")} /><input {...register("rx.right.cyl")} /><input {...register("rx.right.axis")} /><input {...register("rx.right.add")} />
          <strong>LE</strong>
          <input {...register("rx.left.sph")} /><input {...register("rx.left.cyl")} /><input {...register("rx.left.axis")} /><input {...register("rx.left.add")} />
        </div>
        
        {/* 3. RECALL */}
        <h2>3. Recall</h2>
        <div className="grid-form">
          <input type="date" {...register("sightTestDate")} required />
          <select {...register("recallPeriod")} required>
            <option value="3">3 Months</option>
            <option value="6">6 Months</option>
            <option value="9">9 Months</option>
            <option value="12">12 Months</option>
            <option value="18">18 Months</option>
            <option value="24">24 Months</option>
          </select>
          <input {...register("nextTestDate")} readOnly style={{background:'#f3f4f6'}} />
        </div>

        {/* 4. DISPENSE (DYNAMIC) */}
        <h2>4. Dispensing</h2>
        <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
          <div className="grid-form">
            <div>
              <label>Category</label>
              <select {...register("dispense.category")}>
                <option value="Spectacles">Spectacles</option>
                <option value="Contacts">Contacts</option>
                <option value="Fees">Fees / Services</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* DYNAMIC SUB-OPTIONS */}
            <div>
              <label>Type / Item</label>
              {dispenseCategory === "Spectacles" && (
                <select {...register("dispense.type")}>
                  <option value="SVD">SVD</option>
                  <option value="SVN">SVN</option>
                  <option value="SVI">SVI</option>
                  <option value="BIFS">BIFS</option>
                  <option value="VARI">VARI</option>
                  <option value="OTHER">OTHER</option>
                </select>
              )}
              {dispenseCategory === "Contacts" && (
                <select {...register("dispense.type")}>
                  <option value="Contact Lenses">Contact Lenses</option>
                </select>
              )}
              {dispenseCategory === "Fees" && (
                <select {...register("dispense.type")}>
                  <option value="GOS 1">GOS 1</option>
                  <option value="PRIVATE EYE CHECK">PRIVATE EYE CHECK</option>
                  <option value="CONTACT LENS CHECK">CONTACT LENS CHECK</option>
                  <option value="other">Other</option>
                </select>
              )}
              {dispenseCategory === "Other" && (
                <input {...register("dispense.type")} placeholder="Type description..." />
              )}
            </div>
            
            <input {...register("dispense.lensName")} placeholder="Lens/Product Name" />
          </div>
        </div>

        {/* 5. PAYMENT */}
        <h2>5. Payment</h2>
        <div className="grid-form">
            <input {...register("payment.amount")} type="number" step="0.01" placeholder="£ Amount" />
            <select {...register("payment.method")}>
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="BACS">BACS</option>
            </select>
        </div>

        <button type="submit" style={{ marginTop: '2rem', width: '100%' }}>Save Record</button>
      </form>
    </div>
  );
}