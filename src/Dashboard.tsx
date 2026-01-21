import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format, parseISO } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const libraries: ("places")[] = ['places'];

// Helper for Display Text
const toBritishDate = (isoDate: string) => {
  if (!isoDate) return '';
  try { return format(parseISO(isoDate), 'dd/MM/yyyy'); } catch (e) { return isoDate; }
};

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, reset } = useForm<any>();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // -- GOOGLE MAPS --
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY, // <--- CHECK KEY
    libraries,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // -- LOAD PATIENTS --
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
    setValue("dob", patient.dob); // Input needs yyyy-mm-dd
    setValue("address", patient.address);
    setSearchTerm('');
    setFilteredPatients([]);
  };

  const clearForm = () => {
    reset();
    setExistingId(null);
    setSearchTerm('');
  };

  // -- DATES --
  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");
  const dispenseCategory = watch("dispense.category");

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

      if (!patientId) {
        let newIdNumber = 1;
        const ids = allPatients.map(p => parseInt(p.displayId || "0")).sort((a, b) => b - a);
        if (ids.length > 0) newIdNumber = ids[0] + 1;
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

      if (patientId) {
        await updateDoc(doc(db, "patients", patientId), {
          nextTestDate: data.nextTestDate,
          lastSeen: new Date().toISOString()
        });
      }

      alert(`Record Saved!`);
      clearForm();
      window.location.reload(); 

    } catch (e) {
      console.error(e);
      alert("Error saving record.");
    }
  };

  // -- REPORT PDF (British Dates) --
  const generateReport = async () => {
    if (!reportDate) { alert("Select date"); return; }
    const q = query(collection(db, "records")); 
    const snap = await getDocs(q);
    const records = snap.docs.map(d => d.data()).filter((d:any) => d.createdAt && d.createdAt.startsWith(reportDate));

    if (records.length === 0) { alert("No records found"); return; }

    const formattedDate = toBritishDate(reportDate); // dd/mm/yyyy

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Daily Takings: ${formattedDate}`, 14, 20);
    
    const tableData = records.map((rec:any) => [
      rec.dispense?.category || '-', rec.dispense?.type || '-', rec.payment?.method || '-', `£${rec.payment?.amount || '0'}`
    ]);

    let total = records.reduce((sum:number, r:any) => sum + parseFloat(r.payment?.amount || 0), 0);

    autoTable(doc, { head: [['Category', 'Type', 'Method', 'Amount']], body: tableData, startY: 30 });
    // @ts-ignore
    doc.text(`Total: £${total.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 10);
    window.open(doc.output('bloburl'), '_blank');
  };

  if (!isLoaded) return <div>Loading System...</div>;

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff', padding: '15px', borderRadius: '8px' }}>
        <div style={{ position: 'relative', display: 'flex', gap: '10px', flex: 1 }}>
          <input type="text" placeholder="Search Patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: '2px solid #0070f3', maxWidth: '300px' }} />
          <button onClick={clearForm} className="secondary">Clear</button>
          {filteredPatients.length > 0 && (
            <div style={{ position: 'absolute', top: '50px', width: '300px', background: 'white', border: '1px solid #ccc', zIndex: 100, borderRadius: '8px' }}>
              {filteredPatients.map(p => (
                <div key={p.id} onClick={() => selectPatient(p)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                  <strong>#{p.displayId} - {p.fullName}</strong>
                  <br/><span style={{fontSize:'0.8rem', color:'#666'}}>{toBritishDate(p.dob)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{margin:0, fontWeight: 'bold', color: '#3730a3'}}>Report Date:</label>
          {/* Note: Input type='date' MUST be yyyy-mm-dd value, but browser shows dd/mm/yyyy */}
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc' }} />
          <button onClick={generateReport} style={{background:'#059669'}}>PDF Report</button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <h2>1. Details {existingId && <span style={{color:'green'}}>(Existing)</span>}</h2>
        <div className="grid-form">
          <input {...register("fullName")} placeholder="Full Name" disabled={!!existingId} required />
          {/* Form input stays type="date" (browser handles display) */}
          <input type="date" {...register("dob")} disabled={!!existingId} required />
          <div style={{ gridColumn: '1 / -1' }}>
            {!existingId && (
              <Autocomplete onLoad={setAutocomplete} onPlaceChanged={() => { if(autocomplete) setValue("address", autocomplete.getPlace().formatted_address); }} options={{ componentRestrictions: { country: "gb" } }}>
                 <input type="text" placeholder="Address Lookup..." />
              </Autocomplete>
            )}
            <input {...register("address")} readOnly={!!existingId} placeholder="Address" />
          </div>
        </div>

        <h2>2. Clinical Rx</h2>
        <div className="rx-grid">
          <span></span><span className="rx-header">Sph</span><span className="rx-header">Cyl</span><span className="rx-header">Axis</span><span className="rx-header">Add</span>
          <strong>RE</strong><input {...register("rx.right.sph")} /><input {...register("rx.right.cyl")} /><input {...register("rx.right.axis")} /><input {...register("rx.right.add")} />
          <strong>LE</strong><input {...register("rx.left.sph")} /><input {...register("rx.left.cyl")} /><input {...register("rx.left.axis")} /><input {...register("rx.left.add")} />
        </div>
        
        <h2>3. Recall</h2>
        <div className="grid-form">
          <input type="date" {...register("sightTestDate")} required />
          <select {...register("recallPeriod")} required>
            <option value="12">12 Months</option>
            <option value="24">24 Months</option>
            <option value="6">6 Months</option>
            <option value="3">3 Months</option>
          </select>
          <input {...register("nextTestDate")} readOnly style={{background:'#f3f4f6'}} />
        </div>

        <h2>4. Dispensing</h2>
        <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
          <div className="grid-form">
            <select {...register("dispense.category")}><option value="Spectacles">Spectacles</option><option value="Contacts">Contacts</option><option value="Fees">Fees</option><option value="Other">Other</option></select>
            {dispenseCategory === "Spectacles" && <select {...register("dispense.type")}><option value="SVD">SVD</option><option value="VARI">VARI</option><option value="OTHER">OTHER</option></select>}
            {dispenseCategory === "Contacts" && <select {...register("dispense.type")}><option value="Contact Lenses">Contact Lenses</option></select>}
            {dispenseCategory === "Fees" && <select {...register("dispense.type")}><option value="GOS 1">GOS 1</option><option value="PRIVATE EYE CHECK">PRIVATE</option></select>}
            {dispenseCategory === "Other" && <input {...register("dispense.type")} placeholder="Type..." />}
            <input {...register("dispense.lensName")} placeholder="Product Name" />
          </div>
        </div>

        <h2>5. Payment</h2>
        <div className="grid-form">
            <input {...register("payment.amount")} type="number" step="0.01" placeholder="£ Amount" />
            <select {...register("payment.method")}><option value="Card">Card</option><option value="Cash">Cash</option></select>
        </div>

        <button type="submit" style={{ marginTop: '2rem', width: '100%' }}>Save Record</button>
      </form>
    </div>
  );
}