/**
 * Список змін за версією (показується в Налаштуваннях → Оновлення додатку).
 * Оновлюй при кожному релізі: додай ключ semver без префікса "v".
 */
export const RELEASE_NOTES_BY_VERSION = {
    '0.7.5': [
        'Додана інформація про оновлення в налаштуваннях'
    ],
    '0.7.4': [
        'Додана інформація про оновлення в налаштуваннях'
    ],
    '0.7.3': [
        'Автооновлення через GitHub Releases',
        'Релізи публікуються як звичайні (не Draft), див. BUILD.md'
    ],
    '0.7.2': [
        'Перевірка та завантаження оновлень з GitHub',
        'Підтримка Windows (NSIS) та macOS (zip/dmg) у збірці'
    ],
    '0.7.1': [
        'Початкова версія з механізмом оновлень у налаштуваннях'
    ]
};

export function getReleaseNotesForVersion(version) {
    if (!version || typeof version !== 'string') return [];
    const trimmed = version.trim();
    return RELEASE_NOTES_BY_VERSION[trimmed] ?? [];
}
