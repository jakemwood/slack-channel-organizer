document.addEventListener('DOMContentLoaded', async () => {
  const enabledCheckbox = document.getElementById('enabled');
  const ruleCountSpan = document.getElementById('rule-count');
  const organizeNowBtn = document.getElementById('organize-now');
  const openSettingsBtn = document.getElementById('open-settings');
  const statusDiv = document.getElementById('status');

  // Load current state
  const settings = await StorageUtils.getSettings();
  const rules = await StorageUtils.getRules();

  enabledCheckbox.checked = settings.enabled;
  ruleCountSpan.textContent = rules.length;

  // Toggle enabled
  enabledCheckbox.addEventListener('change', async () => {
    await StorageUtils.saveSettings({ ...settings, enabled: enabledCheckbox.checked });
  });

  // Open settings
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Organize now
  organizeNowBtn.addEventListener('click', async () => {
    organizeNowBtn.disabled = true;
    organizeNowBtn.textContent = 'Organizing...';
    statusDiv.className = 'status';
    statusDiv.style.display = 'none';

    try {
      // Send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url?.includes('.slack.com')) {
        throw new Error('Not on a Slack page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'organizeNow' });

      if (response?.success) {
        statusDiv.textContent = `Organized ${response.movedCount || 0} channel(s)`;
        statusDiv.className = 'status success';
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      statusDiv.textContent = error.message;
      statusDiv.className = 'status error';
    } finally {
      organizeNowBtn.disabled = false;
      organizeNowBtn.textContent = 'Organize Now';
    }
  });
});
