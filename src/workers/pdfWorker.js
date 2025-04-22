/* eslint-disable no-restricted-globals */
import jsPDF from 'jspdf';

self.onmessage = async function (e) {
    console.log("pdf generator worker got called")
    const { url, index, options } = e.data;

    try {
        // Create a new PDF
        const pdf = new jsPDF({
            format: options.format,
            orientation: options.orientation,
            unit: "mm",
            hotfixes: ["px_scaling"],
        });

        // Add URL as text to the PDF
        pdf.setFontSize(12);
        pdf.text(url, parseInt(options.border), parseInt(options.border) + 10);
        pdf.setFontSize(10);
        pdf.text(
            "Note: Due to browser security restrictions, only URL is included.",
            parseInt(options.border),
            parseInt(options.border) + 20
        );

        const pdfData = pdf.output("arraybuffer");

        self.postMessage({
            type: 'success',
            data: {
                filename: `page_${index + 1}.pdf`,
                data: pdfData
            },
            index
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message,
            index
        });
    }
};