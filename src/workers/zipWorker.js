/* eslint-disable no-restricted-globals */
import JSZip from 'jszip';

self.onmessage = async function (e) {
    console.log("zip generator worker got called")
    const { pdfs } = e.data;

    try {
        const zip = new JSZip();

        // Add files to zip
        pdfs.forEach((pdf, index) => {
            if (pdf) {
                zip.file(pdf.filename, pdf.data);
                // Report progress
                self.postMessage({
                    type: 'progress',
                    progress: ((index + 1) / pdfs.length) * 100
                });
            }
        });

        // Generate the zip file
        const zipContent = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 9
            }
        }, (metadata) => {
            self.postMessage({
                type: 'compression-progress',
                progress: metadata.percent
            });
        });

        self.postMessage({
            type: 'success',
            data: zipContent
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
};