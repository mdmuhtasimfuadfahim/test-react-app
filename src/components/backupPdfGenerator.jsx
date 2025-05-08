import React, { useState } from 'react';
import axios from 'axios';

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

            const contentDisposition = response.headers['content-disposition'] ||
                response.headers['Content-Disposition'];

            let filename = '';

            if (contentDisposition) {
                const matches = /filename=([^;]+)/.exec(contentDisposition);
                if (matches && matches[1]) {
                    filename = matches[1].replace(/["']/g, '').trim();
                }
            }

            if (!filename) {
                filename = filteredFileData.length > 1 ? `${template?.templateName}.zip` :
                    (filteredFileData[0]?.fileName || 'document') + '.pdf';
            }

            const blob = new Blob([response.data], { type: contentType });

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