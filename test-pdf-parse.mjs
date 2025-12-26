import fs from 'fs/promises';

async function testPdfParse() {
  try {
    console.log('Testing pdf-parse import...');
    
    // Try dynamic import
    const pdfParse = await import('pdf-parse');
    console.log('pdfParse keys:', Object.keys(pdfParse));
    console.log('pdfParse.default:', typeof pdfParse.default);
    console.log('pdfParse itself:', typeof pdfParse);
    
    // Read a test PDF
    const testPdf = '/home/ubuntu/youtube-video-analyzer/test-imports/新・赤原：20250919：２０通目：１４日目・朝.pdf';
    const buffer = await fs.readFile(testPdf);
    console.log('\nPDF buffer size:', buffer.length);
    
    // Try to parse
    if (typeof pdfParse.default === 'function') {
      console.log('\nTrying pdfParse.default()...');
      const data = await pdfParse.default(buffer);
      console.log('Success! Text length:', data.text.length);
      console.log('First 100 chars:', data.text.substring(0, 100));
    } else if (typeof pdfParse === 'function') {
      console.log('\nTrying pdfParse()...');
      const data = await pdfParse(buffer);
      console.log('Success! Text length:', data.text.length);
      console.log('First 100 chars:', data.text.substring(0, 100));
    } else {
      console.log('\nERROR: Cannot find callable function');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPdfParse();
