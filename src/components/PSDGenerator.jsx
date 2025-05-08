import React, { useState } from 'react';
import axios from 'axios';

const PSDGenerator = () => {
    const [fileData, setFileData] = useState([{ fileName: '', psdDataUrl: '' }]);
    const [template, setTemplate] = useState({
        templateName: 'id cards',
        psdFileUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [jsonInput, setJsonInput] = useState('');

    const [showJsonInput, setShowJsonInput] = useState(false);

    // Add new URL input field
    const addUrlField = () => {
        setFileData([...fileData, { fileName: '', psdDataUrl: '' }]);
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
                    psdDataUrl: item.psdDataUrl ? item.psdDataUrl.trim() : ''
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
            const filteredFileData = fileData.filter(item => item.psdDataUrl.trim() !== '');

            const response = await axios({
                url: 'http://localhost:8135/api/document/psd_maker',
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
                (filteredFileData.length > 1 ? 'application/zip' : 'image/vnd.adobe.photoshop');

            // Get filename from Content-Disposition header (case-insensitive)
            const contentDisposition = response.headers['content-disposition'] ||
                response.headers['Content-Disposition'];

            let filename = '';

            if (contentDisposition) {
                // Extract filename from Content-Disposition header
                const matches = /filename=([^;]+)/.exec(contentDisposition);
                if (matches && matches[1]) {
                    // Remove any quotes around the filename
                    filename = matches[1].replace(/["']/g, '').trim();
                }
            }

            // Fallback filename if none provided
            if (!filename) {
                if (filteredFileData.length === 1) {
                    // Single PSD file
                    filename = `${filteredFileData[0].fileName || 'document'}.psd`;
                } else {
                    // ZIP file with multiple PSDs
                    filename = `${template.templateName || 'psd_files'}.zip`;
                }
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
            console.error('Error generating PSD:', error);
            if (error.response) {
                console.error('Response headers:', error.response.headers);
                console.error('Response status:', error.response.status);
            }
            alert('Failed to generate PSD. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="psd-generator">
            <h2>PSD Generator</h2>

            <div className="input-toggle">
                <button
                    type="button"
                    onClick={() => setShowJsonInput(!showJsonInput)}
                >
                    {showJsonInput ? 'Switch to Form Input' : 'Switch to JSON Input'}
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Data URL and Filename inputs */}
                {showJsonInput ? (
                    <div className="json-input-container">
                        <textarea
                            value={jsonInput}
                            onChange={handleJsonInputChange}
                            placeholder={
                                `Paste JSON array here, e.g.:
                                    [{
                                        "fileName": "id_card_001",
                                        "psdDataUrl": "https://api.jsonbin.io/v3/qs/681c2f1b8a456b79669997af"
                                    },
                                    {
                                        "fileName": "id_card_002",
                                        "psdDataUrl": "https://api.jsonbin.io/v3/qs/681c2f1b8a456b79669997af"
                                    }]`
                            }
                            rows={10}
                            style={{ width: '100%' }}
                        />
                        <button type="button" onClick={parseJsonInput}>
                            Parse JSON
                        </button>
                    </div>
                ) : (
                    <>
                        {fileData.map((item, index) => (
                            <div key={index} className="file-input-group">
                                <input
                                    type="text"
                                    value={item.fileName}
                                    onChange={(e) => updateField(index, 'fileName', e.target.value)}
                                    placeholder="Enter ID Name"
                                    required
                                />
                                <input
                                    type="url"
                                    value={item.psdDataUrl}
                                    onChange={(e) => updateField(index, 'psdDataUrl', e.target.value)}
                                    placeholder="Enter PSD Data URL"
                                    required
                                />
                            </div>
                        ))}

                        <button type="button" onClick={addUrlField}>
                            Add Another ID
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

                    <input
                        type="url"
                        value={template.psdFileUrl}
                        onChange={(e) => setTemplate({ ...template, psdFileUrl: e.target.value })}
                        placeholder="PSD Template URL"
                        required
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? 'Generating...' : 'Generate'}
                </button>
            </form>
        </div>
    );
};

export default PSDGenerator;