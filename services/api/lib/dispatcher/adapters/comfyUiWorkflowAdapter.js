// ComfyUI is an optional desktop/server adapter. Only repository-approved templates may execute.

const manifest = require('../../../config/comfyui-workflows.json');
const { toStandardError } = require('../providerErrors');

const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const templates = new Map();

function validateManifest() {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.templates)) {
    throw new Error('Invalid ComfyUI workflow manifest.');
  }
  for (const template of manifest.templates) {
    if (!TEMPLATE_ID_PATTERN.test(String(template.id || ''))) throw new Error('Invalid ComfyUI template id.');
    if (!Number.isInteger(template.version) || template.version < 1) throw new Error(`Invalid version for ComfyUI template ${template.id}.`);
    if (!['image', 'video', 'audio'].includes(template.taskType)) throw new Error(`Invalid task type for ComfyUI template ${template.id}.`);
    if (!template.workflow || typeof template.workflow !== 'object' || Array.isArray(template.workflow)) {
      throw new Error(`Missing workflow for ComfyUI template ${template.id}.`);
    }
    if (!template.bindings || typeof template.bindings !== 'object' || Array.isArray(template.bindings)) {
      throw new Error(`Missing input bindings for ComfyUI template ${template.id}.`);
    }
    templates.set(template.id, Object.freeze(template));
  }
}

validateManifest();

function getBaseUrl() {
  const raw = String(process.env.COMFYUI_BASE_URL || '').trim();
  if (!raw) throw new Error('COMFYUI_BASE_URL is not configured.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('COMFYUI_BASE_URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/$/, '');
}

function cloneWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow));
}

function applyApprovedInputs(template, input) {
  const workflow = cloneWorkflow(template.workflow);
  const supplied = input && typeof input === 'object' ? input : {};
  const reserved = ['workflow', 'nodes', 'endpoint', 'baseUrl', 'apiKey', 'secret'];
  if (reserved.some((key) => Object.prototype.hasOwnProperty.call(supplied, key))) {
    throw new Error('Arbitrary ComfyUI workflow, endpoint, and credential inputs are forbidden.');
  }
  for (const key of Object.keys(supplied)) {
    if (key === 'templateId' || key === 'clientId' || key === 'requestId') continue;
    if (!template.bindings[key]) throw new Error(`Input ${key} is not approved for template ${template.id}.`);
  }
  for (const [inputName, binding] of Object.entries(template.bindings)) {
    if (supplied[inputName] === undefined) {
      if (binding.required) throw new Error(`Missing required input ${inputName} for template ${template.id}.`);
      continue;
    }
    const node = workflow[String(binding.nodeId)];
    if (!node || !node.inputs || typeof binding.input !== 'string') {
      throw new Error(`Invalid binding ${inputName} in template ${template.id}.`);
    }
    node.inputs[binding.input] = supplied[inputName];
  }
  return workflow;
}

async function submitTemplate(input) {
  const templateId = String(input?.templateId || '').trim();
  const template = templates.get(templateId);
  if (!template) throw new Error(`ComfyUI template is not approved: ${templateId || '(missing)'}.`);
  const workflow = applyApprovedInputs(template, input);
  const response = await fetch(`${getBaseUrl()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: input.clientId }),
  });
  if (!response.ok) throw new Error(`ComfyUI rejected template ${templateId} with HTTP ${response.status}.`);
  const data = await response.json();
  if (!data.prompt_id) throw new Error('ComfyUI did not return a prompt_id.');
  return {
    providerId: 'comfyui',
    taskType: template.taskType,
    templateId,
    templateVersion: template.version,
    taskId: data.prompt_id,
    status: 'pending',
  };
}

async function generateForType(taskType, input) {
  try {
    const result = await submitTemplate(input);
    if (result.taskType !== taskType) throw new Error(`Template ${result.templateId} does not support ${taskType}.`);
    return result;
  } catch (error) {
    throw toStandardError(error, 'comfyui', `comfyui-${taskType}`);
  }
}

module.exports = {
  providerId: 'comfyui',
  listApprovedTemplates() {
    return [...templates.values()].map(({ id, version, taskType, label }) => ({ id, version, taskType, label }));
  },
  submitTemplate,
  generateImage(input) {
    return generateForType('image', input);
  },
  generateVideo(input) {
    return generateForType('video', input);
  },
  generateAudio(input) {
    return generateForType('audio', input);
  },
};
