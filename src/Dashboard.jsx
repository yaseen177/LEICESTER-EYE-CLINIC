// Dashboard.jsx
import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { addMonths, format } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const libraries = ['places'];

export default function Dashboard() {
  const { register, handleSubmit, watch, setValue, control, reset } = useForm();
  
  // -- GOOGLE MAPS SETUP --
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY", // INSERT KEY HERE
    libraries,
  });
  const [autocomplete, setAutocomplete] = useState(null);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      // Extract address components if needed, or just use formatted_address
      setValue("address", place.formatted_address); 
    }
  };

  // -- RECALL LOGIC --
  const sightTestDate = watch("sightTestDate");
  const recallMonths = watch("recallPeriod");

  // Automatically update 'nextDue' when test date or period changes
  React.useEffect(() => {
    if (sightTestDate && recallMonths) {
      const nextDate = addMonths(new Date(sightTestDate), parseInt(recallMonths));
      setValue("nextTestDate", format(nextDate, 'yyyy-MM-dd'));
    }
  }, [sightTestDate, recallMonths, setValue]);


  // -- SUBMISSION HANDLER --
  const onSubmit = async (data) => {
    try {
      await addDoc(collection(db, "patients"), {
        ...data,
        createdAt: new Date()
      });
      alert("Patient Record Saved!");
      reset(); // Clear form
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Error saving record");
    }
  };

  // -- REPORT GENERATION --
  const generateReport = () => {
    const doc = new jsPDF();
    doc.text("Daily Management Report", 14, 20);
    
    // In a real app, you would fetch this data from Firestore 'dispenses' collection
    // Here is a dummy example for the PDF blob structure
    const tableData = [
      ["John Doe", "Varifocal", "£250.00", "Card"],
      ["Jane Smith", "Single Vision", "£60.00", "Cash"],
      ["Bob Jones", "Bifocal", "£120.00", "Card"],
    ];

    doc.autoTable({
      head: [['Patient', 'Lens Type', 'Amount', 'Method']],
      body: tableData,
      startY: 30,
    });

    doc.text("Total Takings: £430.00", 14, doc.lastAutoTable.finalY + 10);
    
    // Open PDF in new tab
    const pdfBlob = doc.output('bloburl');
    window.open(pdfBlob, '_blank');
  };

  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* MANAGEMENT BUTTONS */}
      <div style={{ marginBottom: '20px', padding: '10px', background: '#eef' }}>
        <h3>Management Actions</h3>
        <button onClick={generateReport} style={{ padding: '10px' }}>Generate Daily Report (PDF)</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        
        {/* PATIENT DETAILS */}
        <h2>1. Patient Details</h2>
        <div className="grid-form">
          <input {...register("fullName")} placeholder="Full Name" required />
          <input type="date" {...register("dob")} required title="Date of Birth" />
          
          {/* GOOGLE ADDRESS LOOKUP */}
          <Autocomplete
            onLoad={setAutocomplete}
            onPlaceChanged={onPlaceChanged}
          >
             <input type="text" placeholder="Start typing postcode/address..." />
          </Autocomplete>
          
          {/* Hidden real address field linked to form data */}
          <input {...register("address")} placeholder="Selected Address" readOnly />
        </div>

        {/* CLINICAL RX */}
        <h2>2. Clinical Rx</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '5px' }}>
          <strong>Eye</strong><strong>Sph</strong><strong>Cyl</strong><strong>Axis</strong><strong>Add</strong>
          <span>R</span>
          <input {...register("rx.right.sph")} placeholder="+0.00" />
          <input {...register("rx.right.cyl")} placeholder="-0.00" />
          <input {...register("rx.right.axis")} placeholder="000" />
          <input {...register("rx.right.add")} placeholder="+2.00" />
          
          <span>L</span>
          <input {...register("rx.left.sph")} placeholder="+0.00" />
          <input {...register("rx.left.cyl")} placeholder="-0.00" />
          <input {...register("rx.left.axis")} placeholder="000" />
          <input {...register("rx.left.add")} placeholder="+2.00" />
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <label>Intermediate Add: <input {...register("rx.interAdd")} placeholder="+1.00" /></label>
          <label style={{marginLeft: '10px'}}>BVD: <input {...register("rx.bvd")} placeholder="12mm" /></label>
        </div>

        {/* RECALL */}
        <h2>3. Recall & Recommendations</h2>
        <textarea {...register("recommendations")} placeholder="Clinical recommendations..." style={{ width: '100%', height: '60px' }} />
        
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <label>
            Sight Test Date:
            <input type="date" {...register("sightTestDate")} required />
          </label>
          <label>
            Recall Period (Months):
            <select {...register("recallPeriod")} required>
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="9">9 Months</option>
              <option value="12">12 Months</option>
              <option value="18">18 Months</option>
              <option value="24">24 Months</option>
            </select>
          </label>
          <label>
            Next Due:
            <input {...register("nextTestDate")} readOnly style={{ background: '#eee' }} />
          </label>
        </div>

        {/* DISPENSING */}
        <h2>4. Dispensing</h2>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <select {...register("dispense.type")}>
            <option value="SVd">Single Vision Distance (SVd)</option>
            <option value="SVn">Single Vision Near (SVn)</option>
            <option value="SVi">Single Vision Intermediate (SVi)</option>
            <option value="Bifocal_DV_NV">Bifocal (DV+NV)</option>
            <option value="Bifocal_DV_IV">Bifocal (DV+IV)</option>
            <option value="Varifocal">Varifocal</option>
          </select>
          
          <input {...register("dispense.lensName")} placeholder="Manual Lens Name (e.g. Varilux X)" style={{ width: '100%', marginTop: '5px' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <input {...register("dispense.pd")} placeholder="PD (64mm)" />
            <input {...register("dispense.heights")} placeholder="Heights" />
            <input {...register("dispense.panto")} placeholder="Pantoscopic Tilt" />
            <input {...register("dispense.bow")} placeholder="Bow Angle" />
          </div>
        </div>

        {/* PAYMENTS */}
        <h2>5. Payment</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input {...register("payment.amount")} type="number" step="0.01" placeholder="Total £" />
          <select {...register("payment.method")}>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
            <option value="BACS">BACS</option>
          </select>
          <input {...register("payment.discount")} placeholder="Discount Code/Amount" />
        </div>

        <button type="submit" style={{ marginTop: '20px', padding: '15px', width: '100%', fontSize: '1.2rem', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
          Save Patient Record
        </button>
      </form>
    </div>
  );
}