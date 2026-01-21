// Dashboard.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase.ts';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Define the libraries array outside the component to prevent re-renders
const libraries: ("places")[] = ['places'];

export default function Dashboard() {
  // We use 'any' here to allow flexible form data without complex interfaces
  const { register, handleSubmit, watch, setValue, reset } = useForm<any>();
  
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY", // Remember to replace this!
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

  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");

  React.useEffect(() => {
    if (sightTestDate && recallMonths) {
      const nextDate = addMonths(new Date(sightTestDate), parseInt(recallMonths));
      setValue("nextTestDate", format(nextDate, 'yyyy-MM-dd'));
    }
  }, [sightTestDate, recallMonths, setValue]);

  const onSubmit = async (data: any) => {
    try {
      await addDoc(collection(db, "patients"), {
        ...data,
        createdAt: new Date()
      });
      alert("Patient Record Saved!");
      reset(); 
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Error saving record");
    }
  };

  const generateReport = () => {
    const doc = new jsPDF();
    doc.text("Daily Management Report", 14, 20);
    
    const tableData = [
      ["John Doe", "Varifocal", "£250.00", "Card"],
      ["Jane Smith", "Single Vision", "£60.00", "Cash"],
      ["Bob Jones", "Bifocal", "£120.00", "Card"],
    ];

    // @ts-ignore - jspdf-autotable sometimes has type conflict issues
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

  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    // CHANGED: Added className="dashboard-container"
    <div className="dashboard-container"> 
      
      {/* Management Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px' }}>
        <h3 style={{ margin: 0, color: '#3730a3' }}>Admin Actions</h3>
        <button onClick={generateReport}>Generate Daily Report (PDF)</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        
        {/* PATIENT DETAILS */}
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
            {/* Hidden field for logic, but we show the user the lookup box above */}
            <input type="hidden" {...register("address")} />
          </div>
        </div>

        {/* CLINICAL RX - CHANGED TO USE CSS GRID */}
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

        {/* RECALL */}
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
            </select>
          </div>
          <div>
            <label>Next Due Date</label>
            <input {...register("nextTestDate")} readOnly style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
          </div>
        </div>

        {/* DISPENSING */}
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

        {/* PAYMENT */}
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
    </div>
  );
}