import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

import { trapFocusWithin } from '@kk/ui/focus-management';

test('trapFocusWithin wraps forward and backward keyboard focus', () => {
  const dom = new JSDOM(`
    <section tabindex="-1">
      <button id="first">First</button>
      <button disabled>Disabled</button>
      <button id="last">Last</button>
    </section>
  `);
  const document = dom.window.document;
  const panel = document.querySelector<HTMLElement>('section');
  const first = document.querySelector<HTMLButtonElement>('#first');
  const last = document.querySelector<HTMLButtonElement>('#last');

  assert.ok(panel && first && last);

  last.focus();
  const forwardEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  trapFocusWithin(forwardEvent, panel);
  assert.equal(document.activeElement, first);
  assert.equal(forwardEvent.defaultPrevented, true);

  first.focus();
  const backwardEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  trapFocusWithin(backwardEvent, panel);
  assert.equal(document.activeElement, last);
  assert.equal(backwardEvent.defaultPrevented, true);
});

test('trapFocusWithin keeps focus on an empty dialog', () => {
  const dom = new JSDOM('<section tabindex="-1"></section>');
  const panel = dom.window.document.querySelector<HTMLElement>('section');
  assert.ok(panel);

  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  trapFocusWithin(event, panel);

  assert.equal(dom.window.document.activeElement, panel);
  assert.equal(event.defaultPrevented, true);
});
