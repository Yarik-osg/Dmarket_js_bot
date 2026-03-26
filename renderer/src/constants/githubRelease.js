/** Репозиторій збігається з build.publish у package.json */
const OWNER = 'Yarik-osg';
const REPO = 'Dmarket_js_bot';

export const GITHUB_RELEASES_LATEST = `https://github.com/${OWNER}/${REPO}/releases/latest`;

/** Список усіх релізів (не лише latest) */
export const GITHUB_RELEASES_INDEX = `https://github.com/${OWNER}/${REPO}/releases`;

export function githubReleaseTagUrl(version) {
    if (!version) return GITHUB_RELEASES_LATEST;
    const tag = String(version).startsWith('v') ? version : `v${version}`;
    return `https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`;
}
