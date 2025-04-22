import React, { useState } from "react";

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

    const addUrlField = () => {
        setUrls([...urls, ""]);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setProgress({ pdf: 0, zip: 0 });

        try {
            const validUrls = urls.filter((url) => url.trim() !== "");
            const totalUrls = validUrls.length;
            const results = new Array(totalUrls);
            let completedPdfs = 0;

            // Create PDF workers for each URL
            const pdfWorkers = validUrls.map((url, index) => {
                const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url));

                worker.onmessage = (e) => {
                    if (e.data.type === 'success') {
                        results[e.data.index] = e.data.data;
                        completedPdfs++;
                        const percentage = (completedPdfs / totalUrls) * 100;
                        setProgress(prev => ({
                            ...prev,
                            pdf: percentage
                        }));
                    } else if (e.data.type === 'error') {
                        console.error(`Error generating PDF for URL ${index + 1}:`, e.data.error);
                        completedPdfs++;
                        const percentage = (completedPdfs / totalUrls) * 100;
                        setProgress(prev => ({
                            ...prev,
                            pdf: percentage
                        }));
                    }
                };

                return worker;
            });

            // Start PDF generation
            pdfWorkers.forEach((worker, index) => {
                worker.postMessage({
                    url: validUrls[index],
                    index,
                    options
                });
            });

            // Wait for all PDFs to complete
            await new Promise(resolve => {
                const checkCompletion = setInterval(() => {
                    if (completedPdfs === totalUrls) {
                        clearInterval(checkCompletion);
                        resolve();
                    }
                }, 100);
            });

            // Terminate PDF workers
            pdfWorkers.forEach(worker => worker.terminate());

            // Filter out failed PDFs
            const validPdfs = results.filter(result => result !== null);

            if (validPdfs.length === 0) {
                throw new Error("Failed to generate any PDFs");
            }

            // Create ZIP worker
            const zipWorker = new Worker(new URL('../workers/zipWorker.js', import.meta.url));

            zipWorker.onmessage = (e) => {
                if (e.data.type === 'progress' || e.data.type === 'compression-progress') {
                    setProgress(prev => ({
                        ...prev,
                        zip: e.data.progress
                    }));
                } else if (e.data.type === 'success') {
                    const downloadUrl = window.URL.createObjectURL(e.data.data);
                    const link = document.createElement("a");
                    link.href = downloadUrl;
                    link.download = "pdfs.zip";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(downloadUrl);
                    zipWorker.terminate();
                } else if (e.data.type === 'error') {
                    throw new Error(e.data.error);
                }
            };

            zipWorker.postMessage({ pdfs: validPdfs });

        } catch (error) {
            console.error("Error generating PDFs:", error);
            alert("Failed to generate PDFs. Please try again.");
        } finally {
            setLoading(false);
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
                                <span>{Math.floor(progress.pdf * urls.length / 100)} / {urls.length} files</span>
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
            </form>
        </div>
    );
};

export default GeneratePDF;
