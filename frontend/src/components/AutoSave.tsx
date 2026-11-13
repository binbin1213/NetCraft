import { useEffect, useRef } from 'react';
import { App as AntdApp } from 'antd';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import useStore from '../store/useStore';
import { api } from '../api/client';

const AUTO_SAVE_DELAY = 3 * 1000; // debounce after the last edit

/**
 * Syncs the canvas to the cloud a few seconds after the user stops editing.
 *
 * Only runs when the user is logged in AND a cloud project is open; otherwise
 * there is nowhere to save to. Previously this component wrote to a local
 * uuid-keyed project list that never reached the backend.
 */
export default function AutoSave() {
    const { token, currentProjectId, isDirty, markClean } = useStore(
        useShallow((state) => ({
            token: state.token,
            currentProjectId: state.currentProjectId,
            isDirty: state.isDirty,
            markClean: state.markClean,
        }))
    );
    const { message } = AntdApp.useApp();
    const { t } = useTranslation();
    const savedRef = useRef<string>('');

    useEffect(() => {
        if (!token || !currentProjectId || !isDirty) return;

        const timer = setTimeout(async () => {
            const { nodes, edges } = useStore.getState();
            // Guard against saving the exact same payload twice in a row.
            const signature = JSON.stringify({ id: currentProjectId, nodes, edges });
            if (signature === savedRef.current) {
                markClean();
                return;
            }

            try {
                await api.updateProject(currentProjectId, { data: [{ nodes, edges }] });
                savedRef.current = signature;
                markClean();
                console.log('[AutoSave] Project synced to cloud');
            } catch (error) {
                // Stay dirty so the next edit (or manual save) retries.
                console.error('[AutoSave] Cloud sync failed', error);
                message.error(t('autosave.failed'));
            }
        }, AUTO_SAVE_DELAY);

        return () => clearTimeout(timer);
    }, [token, currentProjectId, isDirty, markClean, message, t]);

    return null;
}
