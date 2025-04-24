import React, { useState } from 'react';
import axios from 'axios';

const PdfGenerator = () => {
  const [urls, setUrls] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({
    format: 'A4',
    orientation: 'portrait',
    border: '10mm'
  });

  // Add new URL input field
  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  // Update URL in specific field
  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios({
        url: 'http://localhost:8135/api/document/pdf_maker',
        method: 'POST',
        responseType: 'blob', // Important for receiving binary data
        data: {
          urls: urls.filter(url => url.trim() !== ''),
          options
        }
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'pdfs.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('Failed to generate PDFs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-generator">
      <h2>PDF Generator</h2>
      <form onSubmit={handleSubmit}>
        {/* URL inputs */}
        {urls.map((url, index) => (
          <div key={index}>
            <input
              type="url"
              value={url}
              onChange={(e) => updateUrl(index, e.target.value)}
              placeholder="Enter URL"
              required
            />
          </div>
        ))}

        <button type="button" onClick={addUrlField}>
          Add Another URL
        </button>

        {/* PDF Options */}
        <div className="options">
          <select
            value={options.format}
            onChange={(e) => setOptions({ ...options, format: e.target.value })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
          </select>

          <select
            value={options.orientation}
            onChange={(e) => setOptions({ ...options, orientation: e.target.value })}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>

          <input
            type="text"
            value={options.border}
            onChange={(e) => setOptions({ ...options, border: e.target.value })}
            placeholder="Border (e.g., 10mm)"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Generating PDFs...' : 'Generate PDFs'}
        </button>
      </form>
    </div>
  );
};

export default PdfGenerator;