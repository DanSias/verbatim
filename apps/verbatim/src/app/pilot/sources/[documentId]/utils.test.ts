import { describe, it, expect } from 'vitest';

/**
 * Strip the first markdown heading line from content for preview.
 * Removes lines matching /^#{1,6}\s+.+$/ and a following blank line if present.
 */
function stripFirstHeading(content: string): string {
  const lines = content.split('\n');

  // Check if first line is a markdown heading
  if (lines.length > 0 && /^#{1,6}\s+.+$/.test(lines[0])) {
    // Remove first line (heading)
    lines.shift();

    // Remove following blank line if present
    if (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }

  return lines.join('\n');
}

/**
 * Truncate ID to show first 6 and last 4 characters
 */
function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

describe('stripFirstHeading', () => {
  it('should remove h1 heading and following blank line', () => {
    const input = '# Title\n\nThis is content';
    const expected = 'This is content';
    expect(stripFirstHeading(input)).toBe(expected);
  });

  it('should remove h2 heading and following blank line', () => {
    const input = '## Setup\n\nConfiguration details here';
    const expected = 'Configuration details here';
    expect(stripFirstHeading(input)).toBe(expected);
  });

  it('should remove h3-h6 headings', () => {
    expect(stripFirstHeading('### Section\n\nContent')).toBe('Content');
    expect(stripFirstHeading('#### Section\n\nContent')).toBe('Content');
    expect(stripFirstHeading('##### Section\n\nContent')).toBe('Content');
    expect(stripFirstHeading('###### Section\n\nContent')).toBe('Content');
  });

  it('should handle heading without blank line after', () => {
    const input = '# Title\nContent starts immediately';
    const expected = 'Content starts immediately';
    expect(stripFirstHeading(input)).toBe(expected);
  });

  it('should not remove heading if not at start', () => {
    const input = 'Content first\n# Title\n\nMore content';
    expect(stripFirstHeading(input)).toBe(input);
  });

  it('should handle content with no heading', () => {
    const input = 'Just regular content';
    expect(stripFirstHeading(input)).toBe(input);
  });

  it('should handle empty string', () => {
    expect(stripFirstHeading('')).toBe('');
  });

  it('should handle heading with multiple blank lines after', () => {
    const input = '# Title\n\n\nContent';
    const expected = '\nContent';
    expect(stripFirstHeading(input)).toBe(expected);
  });

  it('should handle content with inline # that is not a heading', () => {
    const input = 'This has #hashtag in it\nMore content';
    expect(stripFirstHeading(input)).toBe(input);
  });

  it('should handle heading with special characters', () => {
    const input = '## Setup & Configuration\n\nDetails here';
    const expected = 'Details here';
    expect(stripFirstHeading(input)).toBe(expected);
  });
});

describe('truncateId', () => {
  it('should truncate long IDs', () => {
    const longId = 'abcdef123456789xyz';
    expect(truncateId(longId)).toBe('abcdef...9xyz');
  });

  it('should not truncate short IDs', () => {
    const shortId = 'abc123';
    expect(truncateId(shortId)).toBe('abc123');
  });

  it('should handle exactly 12 character IDs', () => {
    const id = '123456789012';
    expect(truncateId(id)).toBe(id);
  });

  it('should handle 13 character IDs (just over threshold)', () => {
    const id = '1234567890123';
    expect(truncateId(id)).toBe('123456...0123');
  });
});
