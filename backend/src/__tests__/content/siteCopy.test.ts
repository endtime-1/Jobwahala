import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteCopy } from '../../content/siteCopy';

const repoRoot = path.resolve(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8').replace(/\r\n/g, '\n');

describe('site copy has one source', () => {
  it('the backend copy is identical to the website copy (edit src/content/siteCopy.ts, then copy it)', () => {
    expect(read('backend/src/content/siteCopy.ts')).toBe(read('src/content/siteCopy.ts'));
  });

  it('index.html takes its words from the copy, so the first paint cannot show old text', () => {
    const html = read('index.html');

    for (const marker of ['%SITE_TITLE%', '%SITE_DESCRIPTION%', '%SITE_SHORT_DESCRIPTION%', '%SITE_HERO_TEXT%']) {
      expect(html).toContain(marker);
    }
    expect(html).not.toContain(siteCopy.heroText);
    expect(html).not.toMatch(/escrow|mobile money|freelance gigs across/i);
  });

  it('makes no promise about escrow or payouts', () => {
    expect(Object.values(siteCopy).join(' ')).not.toMatch(/escrow|payout|mobile money/i);
  });
});
