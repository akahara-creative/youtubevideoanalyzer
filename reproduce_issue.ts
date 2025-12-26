import * as fs from 'fs';
const badStructure = fs.readFileSync('job16_structure.txt', 'utf8');

function sanitize(structureMarkdown: string) {
    if (structureMarkdown.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(structureMarkdown);
        if (parsed.structure && typeof parsed.structure === 'string') {
          console.log(`Detected nested JSON in structure. Extracting inner structure.`);
          return parsed.structure;
        }
      } catch (e) {
        console.warn(`Failed to parse potential JSON structure:`, e);
      }
    }
    return structureMarkdown;
}

function parseStructure(md: string) {
  const lines = md.split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentTitle = '';
  let currentContent: string[] = [];

  // Use the NEW Regex logic
  const h2Regex = /^\s*##\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(h2Regex);
    if (match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.trim();
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  return sections;
}

const sanitized = sanitize(badStructure);
console.log('Sanitized Length:', sanitized.length);
const sections = parseStructure(sanitized);
console.log('Sections:', sections.length);
if (sections.length > 0) {
    console.log('First Section:', sections[0].title);
}
