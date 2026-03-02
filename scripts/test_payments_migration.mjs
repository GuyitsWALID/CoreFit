/**
 * Local test for payments migration SQL generation.
 * Run with: node scripts/test_payments_migration.mjs
 *
 * This imports the key functions directly by re-implementing the pure parsing
 * logic (no Deno imports) to validate that payment rows produce SQL correctly.
 */

// Inline the pure functions from migrationService.ts (no Deno/npm imports needed)

const extractInsertBlocks = (fileContent, tableName) => {
  const results = [];
  const prefixRe = /INSERT\s+INTO\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?\s*(\([^)]*\))?\s*VALUES\s*/gis;
  let prefixMatch;

  while ((prefixMatch = prefixRe.exec(fileContent)) !== null) {
    if (prefixMatch[1].toLowerCase() !== tableName.toLowerCase()) continue;

    const colList = prefixMatch[2]
      ? prefixMatch[2].replace(/^\(|\)$/g, '').split(',').map(c => c.trim().replace(/['"`]/g, '').toLowerCase())
      : null;

    // Manually scan for statement-ending semicolon, skipping semicolons inside strings
    const startIdx = prefixMatch.index + prefixMatch[0].length;
    let inSingle = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < fileContent.length; i++) {
      const ch = fileContent[i];
      if (ch === "'" && fileContent[i - 1] !== '\\') inSingle = !inSingle;
      if (ch === ';' && !inSingle) { endIdx = i; break; }
      if (i === fileContent.length - 1) { endIdx = i + 1; }
    }

    const valuesBlock = fileContent.slice(startIdx, endIdx);
    const rows = [];
    let depth = 0, buf = '', inQ = false;

    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (ch === "'" && valuesBlock[i - 1] !== '\\') inQ = !inQ;
      if (!inQ) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      buf += ch;
      if (depth === 0 && (ch === ',' || i === valuesBlock.length - 1) && !inQ) {
        const cleaned = buf.trim().replace(/^,|,$/g, '').trim();
        if (cleaned.startsWith('(')) rows.push(cleaned);
        buf = '';
      }
    }
    results.push({ columns: colList, rows });
  }
  return results;
};

const splitRowValues = (row) => {
  const trimmed = row.replace(/^\(|\),?$/g, '').trim();
  const values = [];
  let buf = '', inSingle = false, inDouble = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const prev = trimmed[i - 1];
    if (ch === "'" && prev !== '\\' && !inDouble) { inSingle = !inSingle; buf += ch; continue; }
    if (ch === '"' && prev !== '\\' && !inSingle) { inDouble = !inDouble; buf += ch; continue; }
    if (ch === ',' && !inSingle && !inDouble) { values.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.length) values.push(buf.trim());
  return values.map(v => {
    if (/^NULL$/i.test(v)) return null;
    const singleMatch = v.match(/^'(.*)'$/s);
    if (singleMatch) return singleMatch[1].replace(/\\'/g, "'").replace(/''/g, "'");
    const doubleMatch = v.match(/^"(.*)"$/s);
    if (doubleMatch) return doubleMatch[1].replace(/\\"/g, '"');
    return v;
  });
};

const rowToObject = (cols, values) => {
  if (!cols) return null;
  const obj = {};
  for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i] === undefined ? null : values[i];
  return obj;
};

// ---- Test with sample MySQL Payments dump ----
const sampleSQL = `
-- phpMyAdmin SQL Dump

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;

INSERT INTO \`Payments\` (\`id\`, \`userId\`, \`planTitle\`, \`amount\`, \`currency\`, \`txRef\`, \`paymentstatus\`, \`paymentMethod\`, \`paymentDate\`, \`expiryDate\`, \`qrCodeData\`, \`productId\`) VALUES
(1, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Gold Plan', 500.00, 'ETB', 'tx-001', 'completed', 'bank_transfer', '2024-01-15 10:30:00', '2024-07-15', '{"userId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","package":"Gold Plan"}', 'f1e2d3c4-b5a6-7890-fedc-ba0987654321'),
(2, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Silver Plan', 300.00, 'ETB', 'tx-002', 'completed', 'cash', '2024-02-20 14:00:00', '2024-08-20', NULL, 'e2d3c4b5-a6f7-8901-edcb-a09876543210'),
(3, 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'Bronze Plan', 150.00, 'ETB', 'tx-003', 'pending', 'mobile', '2024-03-10 09:15:00', '2024-09-10', NULL, NULL);

COMMIT;
`;

console.log('=== Testing extractInsertBlocks ===');
const blocks = extractInsertBlocks(sampleSQL, 'Payments');
console.log('Blocks found:', blocks.length);
if (blocks.length > 0) {
  console.log('Columns:', blocks[0].columns);
  console.log('Rows found:', blocks[0].rows.length);
  
  blocks[0].rows.forEach((row, i) => {
    const vals = splitRowValues(row);
    const obj = rowToObject(blocks[0].columns, vals);
    console.log(`\nRow ${i + 1}:`, JSON.stringify(obj, null, 2));
  });
} else {
  console.log('ERROR: No blocks extracted! The regex is failing to match the SQL.');
}

// Also test with a variant that has no space between VALUES and the first (
const sampleSQL2 = `INSERT INTO \`Payments\` (\`id\`, \`userId\`, \`amount\`) VALUES(1, 'abc-def', 100.00);`;
console.log('\n=== Testing VALUES without space ===');
const blocks2 = extractInsertBlocks(sampleSQL2, 'Payments');
console.log('Blocks found:', blocks2.length);
if (blocks2.length > 0) {
  console.log('Rows:', blocks2[0].rows.length);
} else {
  console.log('ERROR: No blocks matched for VALUES without space variant!');
}

// Test with semicolon inside a string value
const sampleSQL3 = `INSERT INTO \`Payments\` (\`id\`, \`userId\`, \`amount\`, \`qrCodeData\`) VALUES
(1, 'abc-def', 100.00, '{"key":"val;ue"}');`;
console.log('\n=== Testing semicolon inside string value ===');
const blocks3 = extractInsertBlocks(sampleSQL3, 'Payments');
console.log('Blocks found:', blocks3.length);
if (blocks3.length > 0) {
  console.log('Rows:', blocks3[0].rows.length);
  const vals3 = splitRowValues(blocks3[0].rows[0]);
  console.log('qrCodeData value:', vals3[3]);
  if (vals3[3] && vals3[3].includes('val;ue')) {
    console.log('OK: Semicolon in string preserved correctly');
  } else {
    console.log('WARNING: Semicolon in string may have been truncated');
  }
} else {
  console.log('ERROR: Regex broke on semicolon inside string!');
}

console.log('\n=== Done ===');
