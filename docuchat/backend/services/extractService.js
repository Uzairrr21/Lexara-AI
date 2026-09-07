const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

async function extractText(filePath, mimeType) {
  try {
    if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filePath.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    if (mimeType === 'text/plain' || filePath.endsWith('.txt')) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    if (mimeType === 'text/markdown' || filePath.endsWith('.md')) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    // Try reading as text for other types
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Could not extract text: ${err.message}`);
  }
}

module.exports = { extractText };
