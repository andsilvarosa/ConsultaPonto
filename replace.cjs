const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  ['bg-[#0a0a0a]', 'bg-zinc-50 dark:bg-[#0a0a0a]'],
  ['text-zinc-100', 'text-zinc-900 dark:text-zinc-100'],
  ['bg-black/20', 'bg-white/50 dark:bg-black/20'],
  ['border-white/5', 'border-black/5 dark:border-white/5'],
  ['bg-white/5', 'bg-black/5 dark:bg-white/5'],
  ['border-white/10', 'border-black/10 dark:border-white/10'],
  ['bg-[#121214]', 'bg-white dark:bg-[#121214]'],
  ['border-white/[0.04]', 'border-black/[0.04] dark:border-white/[0.04]'],
  ['bg-white/[0.02]', 'bg-black/[0.02] dark:bg-white/[0.02]'],
  ['bg-[#121212]', 'bg-white dark:bg-[#121212]'],
  ['text-zinc-300', 'text-zinc-700 dark:text-zinc-300'],
  ['text-zinc-400', 'text-zinc-600 dark:text-zinc-400'],
  ['text-white', 'text-black dark:text-white'],
  ['bg-black/80', 'bg-black/20 dark:bg-black/80'],
  ['border-white/[0.05]', 'border-black/[0.05] dark:border-white/[0.05]'],
  ['bg-white/[0.03]', 'bg-black/[0.03] dark:bg-white/[0.03]'],
  ['border-white/[0.06]', 'border-black/[0.06] dark:border-white/[0.06]'],
  ['border-white/[0.03]', 'border-black/[0.03] dark:border-white/[0.03]'],
  ['border-white/[0.02]', 'border-black/[0.02] dark:border-white/[0.02]'],
  ['divide-white/[0.02]', 'divide-black/[0.02] dark:divide-white/[0.02]'],
  ['text-zinc-500', 'text-zinc-500 dark:text-zinc-500'], // Keep same for both, but let's not replace if not needed.
];

for (const [search, replace] of replacements) {
  // Use regex to replace all occurrences, but be careful not to double replace
  // e.g. if we replace bg-white/5, we might accidentally replace it inside bg-white/50
  // So we use a regex with word boundaries or specific characters
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9])', 'g');
  content = content.replace(regex, replace);
}

fs.writeFileSync('src/App.tsx', content);
console.log('Done');
