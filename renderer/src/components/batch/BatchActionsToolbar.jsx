import React from 'react';
import { Button, Group, Menu, Text } from '@mantine/core';
import { RiStackLine } from 'react-icons/ri';

/**
 * Batch actions for offers or targets tables. Shown when selectedCount > 0.
 *
 * @param {'offers' | 'targets'} variant
 * @param {() => void} clearSelection — clears row selection in the table
 * @param {(clearSelection: () => void) => void} [onBatchDelete]
 * @param {(clearSelection: () => void) => void} [onBatchSkipParsing] — offers only
 * @param {(clearSelection: () => void) => void} [onBatchUnskipParsing] — offers only
 * @param {(clearSelection: () => void) => void} [onBatchDeactivate] — targets only
 */
export function BatchActionsToolbar({
    variant,
    t,
    selectedCount,
    disabled = false,
    clearSelection,
    onBatchDelete,
    onBatchSkipParsing,
    onBatchUnskipParsing,
    onBatchDeactivate
}) {
    if (selectedCount <= 0) return null;

    return (
        <Group gap="xs" wrap="wrap" align="center">
            <Text size="sm" c="dimmed">
                {t('batch.selected')} {selectedCount}
            </Text>
            <Menu shadow="md" width={260} position="bottom-start" withinPortal>
                <Menu.Target>
                    <Button
                        variant="light"
                        size="xs"
                        leftSection={<RiStackLine size={16} />}
                        disabled={disabled}
                    >
                        {t('batch.actions')}
                    </Button>
                </Menu.Target>
                <Menu.Dropdown>
                    {onBatchDelete ? (
                        <Menu.Item
                            color="red"
                            onClick={() => onBatchDelete(clearSelection)}
                            disabled={disabled}
                        >
                            {t('batch.delete')}
                        </Menu.Item>
                    ) : null}
                    {variant === 'offers' && onBatchSkipParsing ? (
                        <Menu.Item onClick={() => onBatchSkipParsing(clearSelection)} disabled={disabled}>
                            {t('batch.skipParsing')}
                        </Menu.Item>
                    ) : null}
                    {variant === 'offers' && onBatchUnskipParsing ? (
                        <Menu.Item onClick={() => onBatchUnskipParsing(clearSelection)} disabled={disabled}>
                            {t('batch.unskipParsing')}
                        </Menu.Item>
                    ) : null}
                    {variant === 'targets' && onBatchDeactivate ? (
                        <Menu.Item onClick={() => onBatchDeactivate(clearSelection)} disabled={disabled}>
                            {t('batch.deactivate')}
                        </Menu.Item>
                    ) : null}
                </Menu.Dropdown>
            </Menu>
            <Button variant="subtle" size="xs" onClick={clearSelection} disabled={disabled}>
                {t('batch.clearSelection')}
            </Button>
        </Group>
    );
}
