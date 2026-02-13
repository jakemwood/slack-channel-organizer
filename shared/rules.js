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
