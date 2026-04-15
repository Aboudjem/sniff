export const EDGE_CASE_PAYLOADS = {
  xss: [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg/onload=alert(1)>',
    '<img src=x onerror=prompt(1)>',
  ],
  sqli: [
    "' OR '1'='1",
    '1; DROP TABLE users--',
    "' UNION SELECT NULL--",
    '" OR 1=1--',
  ],
  unicode: [
    '\u0000',
    '\uFFFD',
    '\u{1F4A9}',
    '\u202E',
    '\u200B',
  ],
  boundary: [
    '',
    ' ',
    'a'.repeat(10000),
    '-1',
    '0',
    '999999999999999',
    '1.7976931348623157e+308',
  ],
  specialChars: [
    '../../../etc/passwd',
    '%00',
    '\r\n',
    '${7*7}',
    '{{7*7}}',
  ],
} as const;

export type PayloadCategory = keyof typeof EDGE_CASE_PAYLOADS;

/** Select a payload for a given input type. Uses category rotation for coverage. */
export function selectPayload(inputType: string, stepIndex: number): { value: string; category: PayloadCategory } {
  const categories = Object.keys(EDGE_CASE_PAYLOADS) as PayloadCategory[];
  // Rotate through categories based on step index for breadth
  const categoryIndex = stepIndex % categories.length;
  const category = categories[categoryIndex];
  const payloads = EDGE_CASE_PAYLOADS[category];
  const payloadIndex = Math.floor(stepIndex / categories.length) % payloads.length;
  return { value: payloads[payloadIndex], category };
}
