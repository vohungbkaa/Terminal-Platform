const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function groupModelVariants('), source.indexOf('function modelLabelFor(')), context);
vm.runInContext(source.slice(source.indexOf('function activeModelForView('), source.indexOf('function syncAgyModel(')), context);

test('toolbar uses detected model and ignores persisted choices from previous sessions', () => {
  const pane = { agent: 'agy', model: 'old-model' };
  assert.equal(context.activeModelForView({ runningAgent: 'agy', detectedModel: 'live-model' }, pane), 'live-model');
  assert.equal(context.activeModelForView({ runningAgent: 'agy', detectedModel: null }, pane), null);
  assert.equal(context.activeModelForView({ runningAgent: null, detectedModel: 'live-model' }, pane), null);
});

test('agy status resolves catalog IDs including effort and uses the latest status', () => {
  const models = [
    { id: 'neon-medium', label: 'Gemini 4 Neon (Medium)' },
    { id: 'neon-high', label: 'Gemini 4 Neon (High)' }
  ];
  assert.equal(context.agyModelFromStatus(['? for shortcuts       auto · Gemini 4 Neon · medium'], models), 'neon-medium');
  assert.equal(context.agyModelFromStatus(['? for shortcuts   Gemini 4 Neon · medium', '? for shortcuts   Gemini 4 Neon · high'], models), 'neon-high');
  assert.equal(context.agyModelFromStatus(['> explain Gemini 4 Neon · medium'], models), null);
  assert.equal(context.agyModelFromStatus(['? for shortcuts    Unknown model · medium'], models), null);
});

test('model families sort effort levels and preserve distinct model versions', () => {
  const result = context.groupModelVariants([
    { id: 'high', label: 'Neon (High)' },
    { id: 'plain', label: 'Sonnet' },
    { id: 'low', label: 'Neon (Low)' },
    { id: 'medium', label: 'Neon (Medium)' },
    { id: 'version', label: 'Sonnet 4.5' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [
    { label: 'Neon', variants: [
      { id: 'low', label: 'Neon (Low)', effort: 'Low' },
      { id: 'medium', label: 'Neon (Medium)', effort: 'Medium' },
      { id: 'high', label: 'Neon (High)', effort: 'High' }
    ] },
    { label: 'Sonnet', variants: [{ id: 'plain', label: 'Sonnet', effort: null }] },
    { label: 'Sonnet 4.5', variants: [{ id: 'version', label: 'Sonnet 4.5', effort: null }] }
  ]);
  assert.equal(context.groupModelVariants([]).length, 0);
});
