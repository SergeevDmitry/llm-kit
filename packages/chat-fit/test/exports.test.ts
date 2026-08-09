import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

describe('chat-fit public surface', () => {
  it('exports a module namespace', () => {
    expect(Object.keys(api).length).toBeGreaterThan(0);
  });
});
