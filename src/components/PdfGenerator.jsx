import React, { useState } from 'react';
import { PuppeteerCrawler } from 'crawlee';
import { zip } from 'zip-a-folder';
import path from 'path';
import fs from 'fs';

const PdfGenerator = () => {
  const [fileData, setFileData] = useState([{ fileName: '', pdfHtmlUrl: '' }]);
  const [jsonInput, setJsonInput] = useState('');
  const [template, setTemplate] = useState({
    templateName: 'salary sheets',
    format: 'A4',
    orientation: 'portrait',
    border: '10mm'
  });
  const [loading, setLoading] = useState(false);
  const [showJsonInput, setShowJsonInput] = useState(false);

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

  // Handle JSON input change
  const handleJsonInputChange = (e) => {
    setJsonInput(e.target.value);
  };

  // Parse JSON input and update fileData
  const parseJsonInput = () => {
    try {
      // Clean up the input by removing extra whitespace and fixing common JSON syntax issues
      const cleanedInput = jsonInput
        .replace(/\s+/g, ' ')
        .replace(/,\s*]/g, ']')
        .trim();

      const parsedData = JSON.parse(cleanedInput);

      if (Array.isArray(parsedData)) {
        // Validate each item has the required fields
        const validData = parsedData.map(item => ({
          fileName: item.fileName || '',
          pdfHtmlUrl: item.pdfHtmlUrl ? item.pdfHtmlUrl.trim() : ''
        }));

        setFileData(validData);
        setShowJsonInput(false);
        setJsonInput('');
      } else {
        alert('Input must be an array of objects');
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
      alert('Invalid JSON format. Please check your input.');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const filteredFileData = fileData.filter(item => item.pdfHtmlUrl.trim() !== '');
      const tempDir = path.join(process.cwd(), 'temp_pdfs');

      // Create temp directory if it doesn't exist
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      // Initialize the crawler
      const crawler = new PuppeteerCrawler({
        maxConcurrency: 4, // 4 parallel workers
        async requestHandler({ page, request }) {
          const { fileName, url } = request.userData;

          // Set page size based on template
          await page.setViewport({
            width: template.format === 'A4' ? 794 : 816, // A4 or Letter width in pixels
            height: template.format === 'A4' ? 1123 : 1056, // A4 or Letter height in pixels
          });

          // Generate PDF
          await page.pdf({
            path: path.join(tempDir, `${fileName}.pdf`),
            format: template.format,
            landscape: template.orientation === 'landscape',
            margin: {
              top: template.border,
              right: template.border,
              bottom: template.border,
              left: template.border,
            },
          });
        },
      });

      // Prepare requests for crawler
      const requests = filteredFileData.map(item => ({
        url: item.pdfHtmlUrl,
        userData: {
          fileName: item.fileName,
          url: item.pdfHtmlUrl,
        },
      }));

      // Run the crawler
      await crawler.run(requests);

      // Create zip file if multiple PDFs
      let downloadFile;
      if (filteredFileData.length > 1) {
        const zipPath = path.join(process.cwd(), `${template.templateName}.zip`);
        await zip(tempDir, zipPath);
        downloadFile = {
          path: zipPath,
          type: 'application/zip',
          name: `${template.templateName}.zip`
        };
      } else {
        const pdfPath = path.join(tempDir, `${filteredFileData[0].fileName}.pdf`);
        downloadFile = {
          path: pdfPath,
          type: 'application/pdf',
          name: `${filteredFileData[0].fileName}.pdf`
        };
      }

      // Create download link
      const blob = new Blob([fs.readFileSync(downloadFile.path)], { type: downloadFile.type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadFile.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Clean up temp files
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (downloadFile.path.endsWith('.zip')) {
        fs.unlinkSync(downloadFile.path);
      }

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

      <div className="input-toggle">
        <button
          type="button"
          onClick={() => setShowJsonInput(!showJsonInput)}
        >
          {showJsonInput ? 'Switch to Form Input' : 'Switch to JSON Input'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {showJsonInput ? (
          <div className="json-input-container">
            <textarea
              value={jsonInput}
              onChange={handleJsonInputChange}
              placeholder={`Paste JSON array here, e.g.:
[
  {
    "fileName": "webpage1",
    "pdfHtmlUrl": "https://www.york.ac.uk/teaching/cws/wws/webpage1.html"
  },
  {
    "fileName": "webpage2",
    "pdfHtmlUrl": "https://www.york.ac.uk/teaching/cws/wws/webpage2.html"
  }
]`}
              rows={10}
              style={{ width: '100%' }}
            />
            <button type="button" onClick={parseJsonInput}>
              Parse JSON
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}

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