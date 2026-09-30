// Conventional Commits (https://www.conventionalcommits.org): `feat(engine): …`, `fix(tw): …`. commit-and-tag-version
// reads the same types to write CHANGELOG.md (.versionrc), so a wrong type means a missing changelog line.
export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [2, 'always', ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'style', 'chore', 'revert', 'wip']],
		'body-max-line-length': [1, 'always', 150],
	},
};
