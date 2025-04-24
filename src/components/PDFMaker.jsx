import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import html2pdf from "html2pdf.js";
import { jsPDF } from "jspdf";

const GeneratePDF = () => {
    const [urls, setUrls] = useState([""]);
    const [options, setOptions] = useState({
        format: "A4",
        orientation: "portrait",
        border: "10mm",
    });
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({
        pdf: 0,
        zip: 0
    });
    const [jobDuration, setJobDuration] = useState(0);
    const [jobStartTime, setJobStartTime] = useState(null);
    const [error, setError] = useState(null);
    const iframeRef = useRef(null);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [pdfs, setPdfs] = useState([]);

    const handleUrlChange = (index, value) => {
        const newUrls = [...urls];
        // Check if the value contains multiple URLs (separated by newlines)
        if (value.includes('\n')) {
            const urlList = value.split('\n')
                .map(url => url.trim())
                .filter(url => url !== '');

            // Replace the current URL with the first one
            newUrls[index] = urlList[0];

            // Add the rest of the URLs as new entries
            urlList.slice(1).forEach(url => {
                newUrls.push(url);
            });
        } else {
            newUrls[index] = value;
        }
        setUrls(newUrls);
    };

    const removeUrlField = (index) => {
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls);
    };

    const handleOptionChange = (e) => {
        const { name, value } = e.target;
        setOptions((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Modify the handleIframeLoad function to better handle CORS issues
    const handleIframeLoad = async () => {
        if (!loading || !iframeRef.current) return;

        try {
            const validUrls = urls.filter(url => url.trim() !== "");
            if (currentUrlIndex >= validUrls.length) return;

            const iframe = iframeRef.current;
            const url = validUrls[currentUrlIndex];

            try {
                // Try to access iframe document (may fail due to CORS)
                const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

                // Check if we can actually access the content
                if (!iframeDocument || !iframeDocument.body || iframeDocument.body.innerHTML === '') {
                    throw new Error("Empty or inaccessible document");
                }

                console.log("Successfully accessed iframe document");

                // Create PDF options with improved settings
                const pdfOptions = {
                    margin: options.border,
                    filename: `page_${currentUrlIndex + 1}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: true,
                        letterRendering: true,
                        foreignObjectRendering: true
                    },
                    jsPDF: {
                        unit: 'mm',
                        format: options.format,
                        orientation: options.orientation,
                        compress: true
                    }
                };

                // Generate PDF from iframe content
                const pdfBlob = await html2pdf()
                    .from(iframeDocument.body)
                    .set(pdfOptions)
                    .outputPdf('blob');

                // Add to PDFs array
                setPdfs(prev => [...prev, {
                    name: `page_${currentUrlIndex + 1}.pdf`,
                    data: pdfBlob
                }]);

                // Update progress
                const newProgress = ((currentUrlIndex + 1) / validUrls.length) * 100;
                setProgress(prev => ({
                    ...prev,
                    pdf: newProgress
                }));

                // Move to next URL
                setCurrentUrlIndex(prev => prev + 1);
            } catch (corsError) {
                console.error("CORS error accessing iframe content:", corsError);

                // Try an alternative approach - fetch the HTML and inject it
                try {
                    console.log("Trying alternative approach with fetch");

                    // Fetch the URL through the CORS proxy
                    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    const html = await response.text();

                    // Create a temporary div to hold the content
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;

                    // Fix relative URLs in the HTML
                    const baseUrl = new URL(url).origin;
                    const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
                    const images = tempDiv.querySelectorAll('img');
                    const scripts = tempDiv.querySelectorAll('script[src]');

                    links.forEach(link => {
                        if (link.href && link.href.startsWith('/')) {
                            link.href = baseUrl + link.href;
                        }
                    });

                    images.forEach(img => {
                        if (img.src && img.src.startsWith('/')) {
                            img.src = baseUrl + img.src;
                        }
                    });

                    scripts.forEach(script => {
                        if (script.src && script.src.startsWith('/')) {
                            script.src = baseUrl + script.src;
                        }
                    });

                    // Create PDF options
                    const pdfOptions = {
                        margin: options.border,
                        filename: `page_${currentUrlIndex + 1}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: {
                            scale: 2,
                            useCORS: true,
                            allowTaint: true,
                            logging: true
                        },
                        jsPDF: {
                            unit: 'mm',
                            format: options.format,
                            orientation: options.orientation
                        }
                    };

                    // Generate PDF from the temporary div
                    const pdfBlob = await html2pdf()
                        .from(tempDiv)
                        .set(pdfOptions)
                        .outputPdf('blob');

                    // Add to PDFs array
                    setPdfs(prev => [...prev, {
                        name: `page_${currentUrlIndex + 1}.pdf`,
                        data: pdfBlob
                    }]);

                    // Update progress and move to next URL
                    const newProgress = ((currentUrlIndex + 1) / validUrls.length) * 100;
                    setProgress(prev => ({
                        ...prev,
                        pdf: newProgress
                    }));

                    setCurrentUrlIndex(prev => prev + 1);
                } catch (fetchError) {
                    console.error("Error with fetch approach:", fetchError);
                    createFallbackPdf(url, "Failed to fetch content: " + fetchError.message);
                }
            }
        } catch (err) {
            console.error("Error generating PDF:", err);
            const url = urls.filter(url => url.trim() !== "")[currentUrlIndex];
            createFallbackPdf(url, err.message);
        }
    };

    // Effect to load URLs into iframe sequentially
    useEffect(() => {
        if (!loading) return;

        const validUrls = urls.filter(url => url.trim() !== "");

        // If we've processed all URLs, create the ZIP file
        if (currentUrlIndex >= validUrls.length) {
            createZipFile();
            return;
        }

        // Load the next URL into the iframe
        if (iframeRef.current) {
            const url = validUrls[currentUrlIndex];

            // Try a different CORS proxy service
            // Note: These public proxies may have usage limits
            const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            // Alternatives if the above doesn't work:
            // const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            // const corsProxyUrl = `https://cors.eu.org/${url}`;

            try {
                iframeRef.current.src = corsProxyUrl;

                // Set a timeout to handle cases where the iframe might not trigger onLoad
                const timeoutId = setTimeout(() => {
                    console.log("Iframe load timeout - creating fallback PDF");
                    createFallbackPdf(url, "Timeout loading webpage");
                }, 15000); // 15 seconds timeout

                // Store the timeout ID to clear it when iframe loads successfully
                iframeRef.current.onload = () => {
                    clearTimeout(timeoutId);
                    handleIframeLoad();
                };
            } catch (err) {
                console.error("Error loading URL:", err);
                createFallbackPdf(url, err.message);
                setCurrentUrlIndex(prev => prev + 1);
                setError(`Error loading URL: ${err.message}`);
            }
        }
    }, [loading, currentUrlIndex]);

    // Add a helper function to create fallback PDFs
    const createFallbackPdf = (url, errorMessage) => {
        try {
            const doc = new jsPDF({
                orientation: options.orientation,
                unit: 'mm',
                format: options.format
            });

            doc.setFontSize(16);
            doc.text("Webpage PDF", 20, 20);
            doc.setFontSize(12);
            doc.text(`URL: ${url}`, 20, 30);
            doc.text("Note: Due to browser security restrictions, the webpage content", 20, 40);
            doc.text("could not be accessed directly. This is a placeholder PDF.", 20, 50);

            if (errorMessage) {
                doc.text(`Error: ${errorMessage}`, 20, 60);
            }

            // Add to PDFs array
            setPdfs(prev => [...prev, {
                name: `page_${currentUrlIndex + 1}.pdf`,
                data: doc.output('blob')
            }]);

            // Update progress
            const validUrls = urls.filter(url => url.trim() !== "");
            const newProgress = ((currentUrlIndex + 1) / validUrls.length) * 100;
            setProgress(prev => ({
                ...prev,
                pdf: newProgress
            }));

            // Move to next URL
            setCurrentUrlIndex(prev => prev + 1);
        } catch (err) {
            console.error("Error creating fallback PDF:", err);
        }
    };

    // Function to create ZIP file from PDFs
    const createZipFile = async () => {
        try {
            if (pdfs.length === 0) {
                throw new Error("No PDFs were generated successfully");
            }

            setProgress(prev => ({
                ...prev,
                zip: 10
            }));

            const zip = new JSZip();

            // Add PDFs to ZIP
            pdfs.forEach((pdf, index) => {
                zip.file(pdf.name, pdf.data);
                setProgress(prev => ({
                    ...prev,
                    zip: 10 + ((index + 1) / pdfs.length) * 80
                }));
            });

            // Generate ZIP file
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 9
                }
            }, (metadata) => {
                setProgress(prev => ({
                    ...prev,
                    zip: 90 + (metadata.percent * 0.1)
                }));
            });

            // Calculate job duration
            const endTime = Date.now();
            const duration = (endTime - jobStartTime) / 1000; // Convert to seconds
            setJobDuration(duration);

            // Download ZIP file
            saveAs(zipBlob, "pdfs.zip");

            // Reset state
            setProgress(prev => ({
                ...prev,
                zip: 100
            }));
        } catch (err) {
            console.error("Error creating ZIP file:", err);
            setError(`Error creating ZIP file: ${err.message}`);
        } finally {
            setLoading(false);
            setPdfs([]);
            setCurrentUrlIndex(0);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setProgress({ pdf: 0, zip: 0 });
        setJobStartTime(Date.now());
        setJobDuration(0);
        setError(null);
        setPdfs([]);
        setCurrentUrlIndex(0);

        const validUrls = urls.filter((url) => url.trim() !== "");
        if (validUrls.length === 0) {
            setError("Please enter at least one valid URL");
            setLoading(false);
            return;
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">PDF Generator</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl">URLs</h2>
                        <span className="text-sm text-gray-600">
                            Total URLs: {urls.filter(url => url.trim() !== '').length}
                        </span>
                    </div>
                    <div className="url-list space-y-2">
                        {urls.map((url, index) => (
                            <div key={index} className="flex gap-2">
                                <textarea
                                    value={url}
                                    onChange={(e) => handleUrlChange(index, e.target.value)}
                                    placeholder="Enter URL(s) - One per line"
                                    className="flex-1 p-2 border rounded"
                                    required
                                    rows={1}
                                    onInput={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeUrlField(index)}
                                    className="px-4 py-2 bg-red-500 text-white rounded"
                                    disabled={urls.length === 1}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl">Options</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block">Format:</label>
                            <select
                                name="format"
                                value={options.format}
                                onChange={handleOptionChange}
                                className="w-full p-2 border rounded"
                            >
                                <option value="A4">A4</option>
                                <option value="Letter">Letter</option>
                                <option value="Legal">Legal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block">Orientation:</label>
                            <select
                                name="orientation"
                                value={options.orientation}
                                onChange={handleOptionChange}
                                className="w-full p-2 border rounded"
                            >
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                            </select>
                        </div>
                        <div>
                            <label className="block">Border:</label>
                            <input
                                type="text"
                                name="border"
                                value={options.border}
                                onChange={handleOptionChange}
                                className="w-full p-2 border rounded"
                                placeholder="10mm"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || urls.filter(url => url.trim() !== '').length === 0}
                    className={`px-6 py-3 bg-blue-500 text-white rounded ${loading || urls.filter(url => url.trim() !== '').length === 0
                        ? "opacity-50"
                        : "hover:bg-blue-600"
                        }`}
                >
                    {loading ? `Generating PDFs (${Math.round(progress.pdf)}%)` : "Generate PDFs"}
                </button>

                {loading && (
                    <div className="mt-4">
                        <div className="mb-2">
                            <div className="flex justify-between">
                                <span>PDF Generation: {progress.pdf.toFixed(1)}%</span>
                                <span>{Math.floor(progress.pdf * urls.filter(url => url.trim() !== '').length / 100)} / {urls.filter(url => url.trim() !== '').length} files</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded">
                                <div
                                    className="bg-blue-500 rounded h-2 transition-all duration-300"
                                    style={{ width: `${progress.pdf}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between">
                                <span>ZIP Creation: {progress.zip.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded">
                                <div
                                    className="bg-green-500 rounded h-2 transition-all duration-300"
                                    style={{ width: `${progress.zip}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-4 bg-red-100 rounded">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {jobDuration > 0 && !loading && (
                    <div className="mt-4 p-4 bg-gray-100 rounded">
                        <p className="text-gray-700">
                            Total job duration: {jobDuration.toFixed(2)} seconds ({(jobDuration / 60).toFixed(2)} minutes)
                        </p>
                    </div>
                )}
            </form>

            {/* Hidden iframe for loading webpages */}
            <iframe
                ref={iframeRef}
                style={{ display: 'none' }}
                title="webpage-content"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            />
        </div>
    );
};

export default GeneratePDF;