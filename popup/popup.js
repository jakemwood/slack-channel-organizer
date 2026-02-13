/**
MIT License

Copyright (c) 2026 Jake Wood <hello@jakewood.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
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
