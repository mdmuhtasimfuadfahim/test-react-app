import React from 'react';
import './App.css';
import PSDGenerator from './components/PSDGenerator';
import PDFGenerator from './components/backupPdfGenerator';

function App() {
  return (
    <div className="App">
      <PSDGenerator />
      <PDFGenerator />
    </div>
  );
}

export default App;