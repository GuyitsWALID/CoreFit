/**
 * Import Parsers for various file formats
 * Supports: SQL, JSON, CSV, XML, YAML
 */

export interface ParsedRecord {
  [key: string]: any;
}

export interface ParseResult {
  success: boolean;
  data: ParsedRecord[];
  headers: string[];
  error?: string;
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ParseResult {
  try {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, data: [], headers: [], error: 'CSV must have headers and at least one data row' };
    }

    const headers = parseCSVLine(lines[0]);
    const data: ParsedRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const record: ParsedRecord = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index]?.trim() || '';
        });
        data.push(record);
      }
    }

    return { success: true, data, headers };
  } catch (error: any) {
    return { success: false, data: [], headers: [], error: error.message };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse JSON content
 */
export function parseJSON(content: string): ParseResult {
  try {
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return { success: false, data: [], headers: [], error: 'JSON array is empty' };
      }
      const headers = Object.keys(parsed[0]);
      return { success: true, data: parsed, headers };
    }
    
    if (parsed.data && Array.isArray(parsed.data)) {
      if (parsed.data.length === 0) {
        return { success: false, data: [], headers: [], error: 'JSON data array is empty' };
      }
      const headers = Object.keys(parsed.data[0]);
      return { success: true, data: parsed.data, headers };
    }
    
    if (typeof parsed === 'object') {
      const headers = Object.keys(parsed);
      return { success: true, data: [parsed], headers };
    }

    return { success: false, data: [], headers: [], error: 'Invalid JSON structure' };
  } catch (error: any) {
    return { success: false, data: [], headers: [], error: `JSON parse error: ${error.message}` };
  }
}

/**
 * Parse SQL INSERT statements
 */
export function parseSQL(content: string): ParseResult {
  try {
    const data: ParsedRecord[] = [];
    let headers: string[] = [];
    
    const insertRegex = /INSERT\s+INTO\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)\s*VALUES\s*(.+?);/gis;
    const valuesRegex = /\(([^)]+)\)/g;
    
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
      const columns = match[2].split(',').map(col => col.trim().replace(/[`"']/g, ''));
      
      if (headers.length === 0) headers = columns;
      
      const valuesSection = match[3];
      let valuesMatch;
      
      while ((valuesMatch = valuesRegex.exec(valuesSection)) !== null) {
        const values = parseSQLValues(valuesMatch[1]);
        const record: ParsedRecord = {};
        columns.forEach((col, index) => {
          record[col] = values[index] || '';
        });
        data.push(record);
      }
    }
    
    if (data.length === 0) {
      return { success: false, data: [], headers: [], error: 'No valid INSERT statements found' };
    }

    return { success: true, data, headers };
  } catch (error: any) {
    return { success: false, data: [], headers: [], error: `SQL parse error: ${error.message}` };
  }
}

function parseSQLValues(valuesStr: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      if (valuesStr[i + 1] === stringChar) {
        current += char;
        i++;
      } else {
        inString = false;
      }
    } else if (char === ',' && !inString) {
      values.push(current.trim().replace(/^['"]|['"]$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^['"]|['"]$/g, ''));
  return values.map(v => v === 'NULL' ? '' : v);
}

/**
 * Parse XML content
 */
export function parseXML(content: string): ParseResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    
    if (doc.querySelector('parsererror')) {
      return { success: false, data: [], headers: [], error: 'Invalid XML format' };
    }
    
    const data: ParsedRecord[] = [];
    let headers: string[] = [];
    
    const rowElements = doc.querySelectorAll('row, record, item, entry, user, member, client');
    
    const processElements = (elements: NodeListOf<Element>) => {
      elements.forEach(row => {
        const record: ParsedRecord = {};
        Array.from(row.children).forEach(child => {
          record[child.tagName] = child.textContent || '';
          if (!headers.includes(child.tagName)) headers.push(child.tagName);
        });
        Array.from(row.attributes).forEach(attr => {
          record[attr.name] = attr.value;
          if (!headers.includes(attr.name)) headers.push(attr.name);
        });
        if (Object.keys(record).length > 0) data.push(record);
      });
    };
    
    if (rowElements.length === 0) {
      const root = doc.documentElement;
      if (root.children.length > 0) {
        const rows = doc.querySelectorAll(root.children[0].tagName);
        processElements(rows);
      }
    } else {
      processElements(rowElements);
    }
    
    if (data.length === 0) {
      return { success: false, data: [], headers: [], error: 'No data rows found in XML' };
    }

    return { success: true, data, headers };
  } catch (error: any) {
    return { success: false, data: [], headers: [], error: `XML parse error: ${error.message}` };
  }
}

/**
 * Parse YAML content
 */
export function parseYAML(content: string): ParseResult {
  try {
    const lines = content.split('\n');
    const data: ParsedRecord[] = [];
    let headers: string[] = [];
    let currentRecord: ParsedRecord | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      if (trimmed.startsWith('- ')) {
        if (currentRecord && Object.keys(currentRecord).length > 0) {
          data.push(currentRecord);
        }
        currentRecord = {};
        const afterDash = trimmed.substring(2).trim();
        if (afterDash.includes(':')) {
          const [key, ...valueParts] = afterDash.split(':');
          const value = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
          currentRecord[key.trim()] = value;
          if (!headers.includes(key.trim())) headers.push(key.trim());
        }
        continue;
      }
      
      if (trimmed.includes(':') && currentRecord) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        currentRecord[key] = value;
        if (!headers.includes(key)) headers.push(key);
      }
    }
    
    if (currentRecord && Object.keys(currentRecord).length > 0) {
      data.push(currentRecord);
    }
    
    if (data.length === 0) {
      return { success: false, data: [], headers: [], error: 'No data found in YAML' };
    }

    return { success: true, data, headers };
  } catch (error: any) {
    return { success: false, data: [], headers: [], error: `YAML parse error: ${error.message}` };
  }
}

export function getParser(format: string): (content: string) => ParseResult {
  switch (format.toLowerCase()) {
    case 'csv': return parseCSV;
    case 'json': return parseJSON;
    case 'sql': return parseSQL;
    case 'xml': return parseXML;
    case 'yaml':
    case 'yml': return parseYAML;
    default: return parseCSV;
  }
}

export const SUPPORTED_FORMATS = [
  { value: 'csv', label: 'CSV', extension: '.csv', description: 'Comma-separated values' },
  { value: 'json', label: 'JSON', extension: '.json', description: 'JavaScript Object Notation' },
  { value: 'sql', label: 'SQL', extension: '.sql', description: 'SQL INSERT statements' },
  { value: 'xml', label: 'XML', extension: '.xml', description: 'Extensible Markup Language' },
  { value: 'yaml', label: 'YAML', extension: '.yaml,.yml', description: 'YAML Ain\'t Markup Language' },
];
