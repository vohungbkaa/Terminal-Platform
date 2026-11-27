const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function groupModelVariants('), source.indexOf('function modelLabelFor(')), context);
vm.runInContext(source.slice(source.indexOf('function activeModelForView('), source.indexOf('function syncAgentModel(')), context);

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

test('Codex reads the live footer and reasoning, ahead of stale launch/status text', () => {
  const models = [{ id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol (Low)' }, { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra (High)' }];
  const result = context.agentModelFromScreen('codex', [
    'Model: gpt-old (reasoning low, summaries auto)',
    '› Ask Codex to do anything', 'GPT-6.1 Terra high · ~/project', '? for shortcuts', '', ''
  ], models);
  assert.equal(result.model, 'gpt-6.1-terra');
  assert.equal(result.effort, 'high');
  assert.equal(context.agentModelFromScreen('codex', ['OpenAI Codex (v0.169.0)', 'Model: GPT-6.1-Sol (reasoning medium, summaries auto)'], models).effort, 'medium');
  assert.equal(context.agentModelFromScreen('codex', ['• Model changed to gpt-6.1-sol ultra for this session only'], models).effort, 'ultra');
  assert.equal(context.agentModelFromScreen('codex', ['› Explain GPT-6.1-Sol high', '? for shortcuts'], models), null);
  assert.equal(context.agentModelFromScreen('codex', ['Model: fake-model'], models), null);
});

test('Claude reads its own header and confirmed changes without a hardcoded model list', () => {
  assert.equal(context.agentModelFromScreen('claude', [
    '▐▛███▛█ Claude Code v2.1.332', '▝▜██████▀ Sonnet 5 · API Usage Billing', '● high · /effort'
  ], []).model, 'Sonnet 5');
  const result = context.agentModelFromScreen('claude', [
    'Claude Code v2.1.332', 'Sonnet 5 · API Usage Billing', '⎿ Set model to Opus 5'
  ], []);
  assert.equal(result.model, 'Opus 5');
  assert.equal(context.agentModelFromScreen('claude', ['❯ explain Sonnet 5'], []), null);
});

test('Gemini reads its footer, Auto mode, and confirmed model changes', () => {
  assert.equal(context.agentModelFromScreen('gemini', ['~/project  no sandbox  gemini-4-pro  100% context left', '', ''], []).model, 'gemini-4-pro');
  assert.equal(context.agentModelFromScreen('gemini', ['~/project  no sandbox  Auto (Gemini 3)  100% context left'], []).model, 'Auto (Gemini 3)');
  assert.equal(context.agentModelFromScreen('gemini', ['Model set to custom-model (persisted)'], []).model, 'custom-model');
  assert.equal(context.agentModelFromScreen('gemini', ['> explain gemini-4-pro'], []), null);
  assert.equal(context.agentModelFromScreen('codex', ['~/project  no sandbox  gemini-4-pro  100% context left'], []), null);
});

test('Codex selection compares both model and effort', () => {
  const view = { runningAgent: 'codex', detectedModel: 'gpt-6.1-sol', detectedEffort: 'medium' };
  assert.equal(context.isCurrentModelVariant(view, { id: 'gpt-6.1-sol', effort: 'Medium' }), true);
  assert.equal(context.isCurrentModelVariant(view, { id: 'gpt-6.1-sol', effort: 'High' }), false);
  assert.equal(context.isCurrentModelVariant(view, { id: 'gpt-other', effort: 'Medium' }), false);
});

test('agent and process changes clear the previous model and close its picker', () => {
  let handler;
  let closed = 0;
  let drawerClosed = 0;
  const view = { runningAgent: 'agy', agentPid: 1, detectedModel: 'old-model', detectedEffort: 'high' };
  const events = vm.createContext({
    api: { onAgent: callback => { handler = callback; } }, terminals: new Map([['pane', view]]),
    AGENT_MODELS: { agy: {}, codex: {} }, activeModelPopover: { paneId: 'pane' }, agentDrawerAutoPane: 'pane',
    closeAgentDrawer: () => { drawerClosed++; events.agentDrawerAutoPane = null; },
    closeModelPopover: () => { closed++; }, loadAgentModels: async () => [],
    syncAgentModel: () => {}, updatePaneModelButton: () => {}, findPaneState: () => null, error: () => {}
  });
  vm.runInContext(source.slice(source.indexOf('api.onAgent('), source.indexOf('api.onExit(')), events);
  handler('pane', 'codex', null, 2);
  assert.equal(view.detectedModel, null);
  assert.equal(view.detectedEffort, null);
  view.detectedModel = 'gpt-6.1-sol';
  view.detectedEffort = 'medium';
  handler('pane', 'codex', 'stale-launch-flag', 2);
  assert.equal(view.detectedModel, 'gpt-6.1-sol');
  handler('pane', 'codex', null, 3);
  assert.equal(view.detectedModel, null);
  assert.equal(closed, 2);
  assert.equal(drawerClosed, 1);
  events.agentDrawerAutoPane = 'another-pane';
  handler('pane', 'codex', null, 3);
  assert.equal(drawerClosed, 1);
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

const catalogSource = source.slice(source.indexOf('const agentModelRequests ='), source.indexOf('function openModelPopover('));

test('shell startup shows commands for restored/restarted terminals without flashing during an agent launch', async () => {
  let opened = 0;
  const pending = new Set();
  const startup = vm.createContext({
    api: { start: async () => {} }, pendingAgentLaunches: pending, agentDrawerAutoPane: null,
    fit: () => {}, openAgentDrawer: () => { opened++; }
  });
  vm.runInContext(source.slice(source.indexOf('async function start(view)'), source.indexOf('async function newTerminal(')), startup);
  const view = { id: 'restored', runningAgent: null, node: { hidden: false, classList: { remove() {} } } };
  await startup.start(view);
  assert.equal(startup.agentDrawerAutoPane, 'restored');
  assert.equal(opened, 1);
  startup.agentDrawerAutoPane = null;
  pending.add(view.id);
  await startup.start(view);
  assert.equal(opened, 1);
  assert.equal(startup.agentDrawerAutoPane, null);
  pending.clear();
  view.node.hidden = true;
  await startup.start(view);
  assert.equal(opened, 1);
});

test('Orchestrator routing variants are excluded from model choices', () => {
  const groups = context.groupModelVariants([
    { id: 'gemini-pro-orchestrator-neon', label: 'Orchestrator (Neon)' },
    { id: 'gemini-pro-orchestrator', label: 'Orchestrator (Carbon)' },
    { id: 'gemini-pro-orchestrator-argon', label: 'Orchestrator (Argon)' },
    { id: 'gemini-4-neon-high', label: 'Gemini 4 Neon (High)' }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'Gemini 4 Neon');
});

test('Codex reasoning levels are grouped regardless of label casing', () => {
  const groups = context.groupModelVariants([
    { id: 'gpt-6.2-sol', label: 'GPT-6.2-Sol (Xhigh)', effort: 'xhigh' },
    { id: 'gpt-6.2-sol', label: 'GPT-6.2-Sol (high)', effort: 'high' },
    { id: 'gpt-6.2-sol', label: 'GPT-6.2-Sol (ULTRA)', effort: 'ultra' }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'GPT-6.2-Sol');
  assert.deepEqual(Array.from(groups[0].variants, item => item.effort), ['High', 'XHigh', 'Ultra']);
  const labels = vm.createContext({ AGENT_MODELS: { codex: { models: [{ id: 'gpt-6.2-sol', label: 'GPT-6.2-Sol (Xhigh)' }] } } });
  vm.runInContext(source.slice(source.indexOf('function modelLabelFor('), source.indexOf('function updatePaneModelButton(')), labels);
  assert.equal(labels.modelLabelFor('codex', 'gpt-6.2-sol'), 'GPT-6.2-Sol');
});

test('catalog shares the pending fetch and reuses the loaded models', async () => {
  let calls = 0;
  let finish;
  const models = [{ id: 'neon', label: 'Neon' }];
  const catalogContext = vm.createContext({
    AGENT_MODELS: { agy: { models: [] } },
    api: { agentModels: () => { calls++; return new Promise(resolve => { finish = resolve; }); } }
  });
  vm.runInContext(catalogSource, catalogContext);
  const first = catalogContext.loadAgentModels('agy');
  assert.equal(catalogContext.loadAgentModels('agy'), first);
  assert.equal(calls, 1);
  finish(models);
  assert.equal(await first, models);
  assert.equal(await catalogContext.loadAgentModels('agy'), models);
  assert.equal(calls, 1);
});

test('catalog retries after a failed fetch or an empty response', async () => {
  let calls = 0;
  const catalogContext = vm.createContext({
    AGENT_MODELS: { agy: { models: [] } },
    api: { agentModels: async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return calls === 2 ? [] : [{ id: 'neon', label: 'Neon' }];
    } }
  });
  vm.runInContext(catalogSource, catalogContext);
  await assert.rejects(catalogContext.loadAgentModels('agy'), /offline/);
  await assert.rejects(catalogContext.loadAgentModels('agy'), /chưa trả về/);
  assert.equal((await catalogContext.loadAgentModels('agy'))[0].id, 'neon');
  assert.equal(calls, 3);
});

test('Codex with no CLI catalog uses its native model picker', async () => {
  const group = { models: [] };
  const fallback = vm.createContext({ AGENT_MODELS: { codex: group }, api: { agentModels: async () => [] } });
  vm.runInContext(catalogSource, fallback);
  await fallback.loadAgentModels('codex');
  assert.equal(group.nativePicker, true);
});

test('model commands use Codex reasoning syntax and reject control characters', async () => {
  const sent = [];
  const view = { running: true, runningAgent: 'codex', term: { focus() {} } };
  const commands = vm.createContext({ terminals: new Map([['pane', view]]), api: { input: async (...args) => { sent.push(args); } } });
  vm.runInContext(source.slice(source.indexOf('async function applyPaneModel('), source.indexOf('const agentModelRequests =')), commands);
  await commands.applyPaneModel('pane', 'gpt-6.1-sol', 'Ultra');
  assert.deepEqual(sent[0], ['pane', '/model gpt-6.1-sol --reasoning=ultra\r']);
  view.runningAgent = 'agy';
  await commands.applyPaneModel('pane', 'gemini-4-neon-high', 'High');
  assert.deepEqual(sent[1], ['pane', '/model gemini-4-neon-high\r']);
  await assert.rejects(commands.applyPaneModel('pane', 'model\nother-command'), /Model không hợp lệ/);
  await assert.rejects(commands.applyPaneModel('pane', 'model', 'invalid'), /reasoning không hợp lệ/);
  assert.equal(sent.length, 2);
});
