document.addEventListener('DOMContentLoaded', async () => {
  const enabledCheckbox = document.getElementById('enabled');
  const rulesList = document.getElementById('rules-list');
  const addRuleBtn = document.getElementById('add-rule');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const modal = document.getElementById('rule-modal');
  const modalTitle = document.getElementById('modal-title');
  const ruleForm = document.getElementById('rule-form');
  const ruleIdInput = document.getElementById('rule-id');
  const ruleNameInput = document.getElementById('rule-name');
  const ruleTypeSelect = document.getElementById('rule-type');
  const rulePatternInput = document.getElementById('rule-pattern');
  const ruleSectionInput = document.getElementById('rule-section');
  const patternHint = document.getElementById('pattern-hint');
  const cancelBtn = document.getElementById('cancel-btn');

  // Drag state
  let draggedItem = null;
  let draggedIndex = null;

  // Load initial state
  await loadSettings();
  await renderRules();

  // Settings handlers
  enabledCheckbox.addEventListener('change', async () => {
    const settings = await StorageUtils.getSettings();
    await StorageUtils.saveSettings({ ...settings, enabled: enabledCheckbox.checked });
  });

  // Add rule button
  addRuleBtn.addEventListener('click', () => openModal());

  // Modal handlers
  cancelBtn.addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Form submission
  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const ruleData = {
      name: ruleNameInput.value.trim(),
      type: ruleTypeSelect.value,
      pattern: rulePatternInput.value.trim(),
      targetSection: ruleSectionInput.value.trim()
    };

    const ruleId = ruleIdInput.value;

    if (ruleId) {
      await StorageUtils.updateRule(ruleId, ruleData);
    } else {
      await StorageUtils.addRule(ruleData);
    }

    closeModal();
    await renderRules();
  });

  // Pattern type hint
  ruleTypeSelect.addEventListener('change', updatePatternHint);

  // Export
  exportBtn.addEventListener('click', async () => {
    const data = await StorageUtils.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slack-organizer-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      await StorageUtils.importData(text);
      await loadSettings();
      await renderRules();
      alert('Rules imported successfully!');
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }

    importFile.value = '';
  });

  // Functions
  async function loadSettings() {
    const settings = await StorageUtils.getSettings();
    enabledCheckbox.checked = settings.enabled;
  }

  async function renderRules() {
    const rules = await StorageUtils.getRules();

    if (rules.length === 0) {
      rulesList.innerHTML = '<div class="empty-state">No rules yet. Click "Add Rule" to create one.</div>';
      return;
    }

    rulesList.innerHTML = rules.map((rule, index) => `
      <div class="rule-item ${rule.enabled ? '' : 'disabled'}"
           data-index="${index}"
           data-id="${rule.id}"
           draggable="true">
        <div class="drag-handle">&#9776;</div>
        <div class="rule-info">
          <div class="rule-name">${escapeHtml(rule.name)}</div>
          <div class="rule-details">
            <code>${escapeHtml(rule.type)}: ${escapeHtml(rule.pattern)}</code>
          </div>
        </div>
        <span class="rule-arrow">&rarr;</span>
        <span class="rule-section">${escapeHtml(rule.targetSection)}</span>
        <div class="rule-actions">
          <button type="button" class="toggle-btn" title="${rule.enabled ? 'Disable' : 'Enable'}">
            ${rule.enabled ? '&#10003;' : '&#10007;'}
          </button>
          <button type="button" class="edit-btn" title="Edit">&#9998;</button>
          <button type="button" class="delete-btn" title="Delete">&times;</button>
        </div>
      </div>
    `).join('');

    // Attach event listeners
    rulesList.querySelectorAll('.rule-item').forEach((item) => {
      const id = item.dataset.id;
      const index = parseInt(item.dataset.index);

      // Drag events
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        draggedIndex = index;
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedItem = null;
        draggedIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem !== item) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (draggedItem && draggedIndex !== index) {
          await StorageUtils.reorderRules(draggedIndex, index);
          await renderRules();
        }
      });

      // Action buttons
      item.querySelector('.toggle-btn').addEventListener('click', async () => {
        const rules = await StorageUtils.getRules();
        const rule = rules.find(r => r.id === id);
        await StorageUtils.updateRule(id, { enabled: !rule.enabled });
        await renderRules();
      });

      item.querySelector('.edit-btn').addEventListener('click', async () => {
        const rules = await StorageUtils.getRules();
        const rule = rules.find(r => r.id === id);
        openModal(rule);
      });

      item.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this rule?')) {
          await StorageUtils.deleteRule(id);
          await renderRules();
        }
      });
    });
  }

  function openModal(rule = null) {
    modalTitle.textContent = rule ? 'Edit Rule' : 'Add Rule';
    ruleIdInput.value = rule?.id || '';
    ruleNameInput.value = rule?.name || '';
    ruleTypeSelect.value = rule?.type || 'startsWith';
    rulePatternInput.value = rule?.pattern || '';
    ruleSectionInput.value = rule?.targetSection || '';
    updatePatternHint();
    modal.hidden = false;
    ruleNameInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    ruleForm.reset();
  }

  function updatePatternHint() {
    const hints = {
      startsWith: 'Channel names starting with this text will match',
      endsWith: 'Channel names ending with this text will match',
      contains: 'Channel names containing this text will match',
      exact: 'Channel names exactly matching this text will match',
      regex: 'Use a JavaScript regular expression (e.g., ^eng-.+ or team-\\d+)'
    };
    patternHint.textContent = hints[ruleTypeSelect.value] || '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
