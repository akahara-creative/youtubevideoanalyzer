
import fs from 'fs';

const content = fs.readFileSync('rag_doc_8.txt', 'utf-8');

// Remove script tags and their content (JSON-LD)
const noScript = content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");

// Remove HTML tags
const textOnly = noScript.replace(/<[^>]*>/g, "");

// Remove extra whitespace/newlines for a cleaner count
const cleanText = textOnly.replace(/\s+/g, '').trim();

console.log(`Original Length: ${content.length}`);
console.log(`Text Only Length: ${cleanText.length}`);
console.log(`Preview (first 100 chars): ${cleanText.substring(0, 100)}`);
