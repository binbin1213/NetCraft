import { useEffect } from 'react';
import useStore from '../store/useStore';

const AUTO_SAVE_INTERVAL = 30 * 1000; // 30 seconds

export default function AutoSave() {
    const { saveProject, currentProjectId } = useStore();
    
    useEffect(() => {
        if (!currentProjectId) return;

        const timer = setInterval(() => {
            saveProject();
            // We can show a subtle message or just log it
            console.log('[AutoSave] Project synced to storage');
        }, AUTO_SAVE_INTERVAL);

        return () => clearInterval(timer);
    }, [currentProjectId, saveProject]);

    return null;
}
