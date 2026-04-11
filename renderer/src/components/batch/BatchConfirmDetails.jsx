import React from 'react';

/**
 * Rich confirm body: short intro + scrollable list of items (title + detail lines).
 *
 * @param {React.ReactNode} intro
 * @param {{ key?: string, title: string, lines: string[] }[]} items
 */
export function BatchConfirmDetails({ intro, items }) {
    return (
        <div>
            <div style={{ lineHeight: 1.6, marginBottom: 4 }}>{intro}</div>
            <div
                style={{
                    maxHeight: 280,
                    overflowY: 'auto',
                    marginTop: 12,
                    padding: '4px 12px 12px',
                    backgroundColor: 'var(--bg-tertiary, #333)',
                    borderRadius: 8,
                    border: '1px solid var(--border-color, #444)'
                }}
            >
                {items.map((item, idx) => (
                    <div
                        key={item.key ?? idx}
                        style={{
                            padding: '12px 0',
                            borderBottom:
                                idx < items.length - 1 ? '1px solid var(--border-color, #3a3a3a)' : 'none'
                        }}
                    >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                            {item.title}
                        </div>
                        {item.lines.map((line, li) => (
                            <div
                                key={li}
                                style={{
                                    fontSize: 13,
                                    color: 'var(--text-secondary, #aaa)',
                                    marginTop: 4
                                }}
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
