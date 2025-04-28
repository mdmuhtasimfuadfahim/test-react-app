import React, { useState } from 'react';
import axios from 'axios';

const PdfGenerator = () => {
  const [fileData, setFileData] = useState([{ fileName: '', pdfHtmlUrl: '' }]);
  const [template, setTemplate] = useState({
    templateName: 'salary sheets',
    format: 'A4',
    orientation: 'portrait',
    border: '10mm'
  });
  const [loading, setLoading] = useState(false);

  // Add new URL input field
  const addUrlField = () => {
    setFileData([...fileData, { fileName: '', pdfHtmlUrl: '' }]);
  };

  // Update URL and filename in specific field
  const updateField = (index, field, value) => {
    const newFileData = [...fileData];
    newFileData[index] = { ...newFileData[index], [field]: value };
    setFileData(newFileData);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const filteredFileData = fileData.filter(item => item.pdfHtmlUrl.trim() !== '');

      const response = await axios({
        url: 'http://localhost:8135/api/document/pdf_maker',
        method: 'POST',
        responseType: 'blob',
        data: {
          fileData: filteredFileData,
          template
        }
      });

      // Get content type from response (case-insensitive)
      const contentType = response.headers['content-type'] ||
        response.headers['Content-Type'] ||
        'application/octet-stream';

      // Get filename from Content-Disposition header (case-insensitive)
      const contentDisposition = response.headers['content-disposition'] ||
        response.headers['Content-Disposition'];

      let filename = '';

      if (contentDisposition) {
        // Extract filename from Content-Disposition header with improved regex
        const matches = /filename=([^;]+)/.exec(contentDisposition);
        if (matches && matches[1]) {
          // Remove any quotes around the filename
          filename = matches[1].replace(/["']/g, '').trim();
        }
      }

      // Fallback filename based on number of files
      if (!filename) {
        filename = filteredFileData.length > 1 ? `${template?.templateName}.zip` :
          (filteredFileData[0]?.fileName || 'document') + '.pdf';
      }

      // Create blob with correct type
      const blob = new Blob([response.data], { type: contentType });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating document:', error);
      // Log more details about the error
      if (error.response) {
        console.error('Response headers:', error.response.headers);
        console.error('Response status:', error.response.status);
      }
      alert('Failed to generate document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-generator">
      <h2>PDF Generator</h2>
      <form onSubmit={handleSubmit}>
        {/* URL and Filename inputs */}
        {fileData.map((item, index) => (
          <div key={index} className="file-input-group">
            <input
              type="text"
              value={item.fileName}
              onChange={(e) => updateField(index, 'fileName', e.target.value)}
              placeholder="Enter File Name"
              required
            />
            <input
              type="url"
              value={item.pdfHtmlUrl}
              onChange={(e) => updateField(index, 'pdfHtmlUrl', e.target.value)}
              placeholder="Enter URL"
              required
            />
          </div>
        ))}

        <button type="button" onClick={addUrlField}>
          Add Another URL
        </button>

        {/* Template Options */}
        <div className="template-options">
          <input
            type="text"
            value={template.templateName}
            onChange={(e) => setTemplate({ ...template, templateName: e.target.value })}
            placeholder="Template Name"
          />

          <select
            value={template.format}
            onChange={(e) => setTemplate({ ...template, format: e.target.value })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
          </select>

          <select
            value={template.orientation}
            onChange={(e) => setTemplate({ ...template, orientation: e.target.value })}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>

          <input
            type="text"
            value={template.border}
            onChange={(e) => setTemplate({ ...template, border: e.target.value })}
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