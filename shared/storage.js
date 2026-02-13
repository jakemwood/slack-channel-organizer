const StorageUtils = {
  // Default settings
  defaultSettings: {
    enabled: true
  },

  // Get all rules
  async getRules() {
    const result = await chrome.storage.sync.get('rules');
    return result.rules || [];
  },

  // Save all rules
  async saveRules(rules) {
    await chrome.storage.sync.set({ rules });
  },

  // Add a new rule
  async addRule(rule) {
    const rules = await this.getRules();
    const newRule = {
      id: crypto.randomUUID(),
      enabled: true,
      ...rule
    };
    rules.push(newRule);
    await this.saveRules(rules);
    return newRule;
  },

  // Update a rule
  async updateRule(id, updates) {
    const rules = await this.getRules();
    const index = rules.findIndex(r => r.id === id);
    if (index !== -1) {
      rules[index] = { ...rules[index], ...updates };
      await this.saveRules(rules);
    }
    return rules[index];
  },

  // Delete a rule
  async deleteRule(id) {
    const rules = await this.getRules();
    const filtered = rules.filter(r => r.id !== id);
    await this.saveRules(filtered);
  },

  // Reorder rules
  async reorderRules(fromIndex, toIndex) {
    const rules = await this.getRules();
    const [removed] = rules.splice(fromIndex, 1);
    rules.splice(toIndex, 0, removed);
    await this.saveRules(rules);
  },

  // Get settings
  async getSettings() {
    const result = await chrome.storage.sync.get('settings');
    return { ...this.defaultSettings, ...result.settings };
  },

  // Save settings
  async saveSettings(settings) {
    await chrome.storage.sync.set({ settings });
  },

  // Export all data as JSON
  async exportData() {
    const rules = await this.getRules();
    const settings = await this.getSettings();
    return JSON.stringify({ rules, settings }, null, 2);
  },

  // Import data from JSON
  async importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (data.rules) {
      await this.saveRules(data.rules);
    }
    if (data.settings) {
      await this.saveSettings(data.settings);
    }
  }
};
