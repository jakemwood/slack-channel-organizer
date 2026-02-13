const RuleMatcher = {
  // Check if a channel name matches a rule
  matches(channelName, rule) {
    if (!rule.enabled) {
      return false;
    }

    const name = channelName.toLowerCase();
    const pattern = rule.pattern.toLowerCase();

    switch (rule.type) {
      case 'startsWith':
        return name.startsWith(pattern);

      case 'endsWith':
        return name.endsWith(pattern);

      case 'contains':
        return name.includes(pattern);

      case 'exact':
        return name === pattern;

      case 'regex':
        try {
          const regex = new RegExp(rule.pattern, 'i');
          return regex.test(channelName);
        } catch (e) {
          console.error('Invalid regex pattern:', rule.pattern, e);
          return false;
        }

      default:
        return false;
    }
  },

  // Find the first matching rule for a channel (first match wins)
  findMatchingRule(channelName, rules) {
    for (const rule of rules) {
      if (this.matches(channelName, rule)) {
        return rule;
      }
    }
    return null;
  },

  // Get target section for a channel based on rules
  getTargetSection(channelName, rules) {
    const matchingRule = this.findMatchingRule(channelName, rules);
    return matchingRule?.targetSection || null;
  }
};
