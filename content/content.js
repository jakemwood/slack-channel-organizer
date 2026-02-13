(() => {
  // State
  let isInitialized = false;
  let isOrganizing = false;
  let debounceTimer = null;

  // Initialize when Slack sidebar is ready
  function init() {
    if (isInitialized) return;

    const sidebar = document.querySelector('[data-qa="slack_kit_list"]');
    if (!sidebar) {
      // Retry until sidebar loads
      setTimeout(init, 1000);
      return;
    }

    isInitialized = true;
    console.log('[SlackOrganizer] Initialized');

    // Run initial organization
    runOrganizer();

    // Watch for sidebar changes
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runOrganizer, 2000);
    });

    observer.observe(sidebar, {
      childList: true,
      subtree: true
    });
  }

  // Main organizer function
  async function runOrganizer() {
    if (isOrganizing) return;

    const settings = await StorageUtils.getSettings();
    if (!settings.enabled) {
      console.log('[SlackOrganizer] Disabled, skipping');
      return;
    }

    isOrganizing = true;
    console.log('[SlackOrganizer] Running...');

    try {
      const result = await organizeChannels();
      console.log('[SlackOrganizer] Done:', result);
    } catch (error) {
      console.error('[SlackOrganizer] Error:', error);
    } finally {
      isOrganizing = false;
    }
  }

  // Organize channels based on rules
  async function organizeChannels() {
    const rules = await StorageUtils.getRules();
    if (rules.length === 0) {
      return { movedCount: 0, message: 'No rules configured' };
    }

    // Get current sections from DOM
    const sections = getSectionsFromDOM();
    console.log('[SlackOrganizer] Found sections:', sections);

    // Get current channels from DOM
    const channels = getChannelsFromDOM();
    console.log('[SlackOrganizer] Found channels:', channels.length);

    // Build section name to ID map (case-insensitive)
    const sectionMap = new Map();
    sections.forEach(s => {
      sectionMap.set(s.name.toLowerCase(), s.id);
    });

    // Find channels that need to move
    const toMove = [];

    for (const channel of channels) {
      // Skip DMs (type === 'im')
      if (channel.type === 'im') continue;

      const matchingRule = RuleMatcher.findMatchingRule(channel.name, rules);
      if (!matchingRule) continue;

      const targetSectionId = sectionMap.get(matchingRule.targetSection.toLowerCase());
      if (!targetSectionId) {
        console.log(`[SlackOrganizer] Section "${matchingRule.targetSection}" not found for channel "${channel.name}"`);
        continue;
      }

      // Only move if not already in target section
      if (channel.sectionId !== targetSectionId) {
        toMove.push({
          channelId: channel.id,
          channelName: channel.name,
          targetSectionId,
          targetSectionName: matchingRule.targetSection
        });
      }
    }

    if (toMove.length === 0) {
      return { movedCount: 0, message: 'All channels already organized' };
    }

    console.log('[SlackOrganizer] Moving channels:', toMove);

    // Group by target section for batch API call
    const bySection = new Map();
    for (const item of toMove) {
      if (!bySection.has(item.targetSectionId)) {
        bySection.set(item.targetSectionId, []);
      }
      bySection.get(item.targetSectionId).push(item.channelId);
    }

    // Make API call
    const token = getSlackToken();
    if (!token) {
      throw new Error('Could not find Slack token');
    }

    const insertions = [];
    for (const [sectionId, channelIds] of bySection) {
      insertions.push({
        channel_section_id: sectionId,
        channel_ids: channelIds
      });
    }

    await moveChannelsAPI(token, insertions);

    return { movedCount: toMove.length, moved: toMove };
  }

  // Get sections from sidebar DOM
  function getSectionsFromDOM() {
    const sections = [];
    const sectionElements = document.querySelectorAll('[id^="sectionHeading-"]');

    sectionElements.forEach(el => {
      const id = el.id.replace('sectionHeading-', '');
      const name = el.getAttribute('aria-label');

      if (id && name) {
        sections.push({ id, name });
      }
    });

    return sections;
  }

  // Get channels from sidebar DOM
  function getChannelsFromDOM() {
    const channels = [];
    const channelElements = document.querySelectorAll('[data-qa-channel-sidebar-channel-id]');

    channelElements.forEach(el => {
      const id = el.getAttribute('data-qa-channel-sidebar-channel-id');
      const sectionId = el.getAttribute('data-qa-channel-sidebar-channel-section-id');
      const type = el.getAttribute('data-qa-channel-sidebar-channel-type');
      const nameEl = el.querySelector('.p-channel_sidebar__name span');
      const name = nameEl?.textContent?.trim();

      if (id && name) {
        channels.push({ id, name, sectionId, type });
      }
    });

    return channels;
  }

  // Get team ID from URL path (e.g., /client/T02C934T6HZ/...)
  function getTeamIdFromURL() {
    const pathParts = location.pathname.split('/');
    // URL format: /client/{teamId}/{channelId}
    if (pathParts[1] === 'client' && pathParts[2]?.startsWith('T')) {
      return pathParts[2];
    }
    return null;
  }

  // Get Slack token from localStorage
  function getSlackToken() {
    try {
      const localConfig = JSON.parse(localStorage.getItem('localConfig_v2'));
      if (!localConfig?.teams) return null;

      const teamId = getTeamIdFromURL();
      if (!teamId) {
        console.error('[SlackOrganizer] Could not extract team ID from URL');
        return null;
      }

      const team = Object.values(localConfig.teams).find(t => t.id === teamId);

      return team?.token || null;
    } catch (error) {
      console.error('[SlackOrganizer] Failed to get token:', error);
      return null;
    }
  }

  // Call Slack API to move channels
  async function moveChannelsAPI(token, insertions) {
    const formData = new FormData();
    formData.append('token', token);
    formData.append('insert', JSON.stringify(insertions));
    formData.append('remove', '[]');
    formData.append('_x_reason', 'slack-channel-organizer');
    formData.append('_x_mode', 'online');
    formData.append('_x_sonic', 'true');
    formData.append('_x_app_name', 'client');

    const response = await fetch('/api/users.channelSections.channels.bulkUpdate', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || 'API call failed');
    }

    return result;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'organizeNow') {
      organizeChannels()
        .then(result => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    }
  });

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
