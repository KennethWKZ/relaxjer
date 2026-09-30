// Runs on the staged files only (from .husky/pre-commit). Prettier and ESLint fix what they can; the commit then
// carries the fixed files.
export default {
	'*.{js,mjs,cjs}': ['eslint --max-warnings=0 --no-warn-ignored --fix', 'prettier --write'],
	'*.{json,css,html,md,yml,yaml}': ['prettier --write --ignore-unknown'],
};
