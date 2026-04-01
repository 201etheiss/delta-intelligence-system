/**
 * Response Validator
 *
 * Lightweight post-processing that fixes common AI response issues.
 * Applied after the model generates content, before returning to the user.
 */

/**
 * Comprehensive emoji removal using Unicode property escapes.
 * Strips ALL emoji including newer Unicode 15+ additions.
 */
/**
 * Strip emojis using surrogate pair ranges.
 * Covers: emoticons, symbols, transport, flags, dingbats, variation selectors,
 * skin tone modifiers, ZWJ sequences, and extended pictographics.
 */
function stripEmojis(text: string): string {
  // Comprehensive surrogate pair patterns for all emoji blocks
  return text
    // Miscellaneous Symbols & Dingbats
    .replace(/[\u2600-\u26FF\u2700-\u27BF]/g, '')
    // Variation selectors and ZWJ
    .replace(/[\uFE00-\uFE0F\u200D]/g, '')
    // Emoticons (U+1F600-1F64F)
    .replace(/\uD83D[\uDE00-\uDE4F]/g, '')
    // Misc Symbols & Pictographs (U+1F300-1F5FF)
    .replace(/\uD83C[\uDF00-\uDFFF]/g, '')
    .replace(/\uD83D[\uDC00-\uDDFF]/g, '')
    // Transport & Map (U+1F680-1F6FF)
    .replace(/\uD83D[\uDE80-\uDEFF]/g, '')
    // Supplemental Symbols (U+1F900-1F9FF) and Extended-A (U+1FA00-1FAFF)
    .replace(/\uD83E[\uDD00-\uDDFF]/g, '')
    .replace(/\uD83E[\uDE00-\uDEFF]/g, '')
    // Enclosed characters and arrows
    .replace(/[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2B00-\u2BFF\u3000-\u303F]/g, '');
}

export function validateResponse(content: string): string {
  let fixed = content;

  // Remove emojis (the model sometimes ignores the no-emoji rule)
  fixed = stripEmojis(fixed);

  // Remove common emoji-like symbols that slip through: ⚠️ ✅ ❌ ⭐ 📊 📈 📉 🔍 💡 🎯 etc.
  fixed = fixed.replace(/[⚠✅❌⭐📊📈📉🔍💡🎯🔑🚀💰📋🏢🔒🔓⬆⬇➡⬅▶◀🟢🟡🔴⚡🛡️📌🗓️✨🎉👍👎💬📎🔔]/g, '');

  // Remove double spaces left by emoji removal
  fixed = fixed.replace(/  +/g, ' ');

  // Remove "certainly", "of course", "happy to help" filler
  fixed = fixed.replace(/^(Certainly!?|Of course!?|Happy to help!?|Sure!?|Absolutely!?|Great question!?|I'd be happy to!?|Let me help!?)\s*/gim, '');

  // Remove trailing whitespace from lines
  fixed = fixed.replace(/[ \t]+$/gm, '');

  // Clean up lines that are now empty after emoji removal
  fixed = fixed.replace(/^\s*\n/gm, '\n');

  return fixed.trim();
}
