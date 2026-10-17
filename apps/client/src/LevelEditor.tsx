import { useEffect, useState, type SubmitEvent } from 'react';
import { useLanguage } from './language.js';

export function LevelEditor({
    value,
    disabled,
    onSave,
    onEditingChange,
}: {
    value: number;
    disabled: boolean;
    onSave: (level: number) => Promise<void>;
    onEditingChange?: (editing: boolean) => void;
}) {
    const { t } = useLanguage();
    const [level, setLevel] = useState(String(value));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nextLevel = Number(level);
    const valid = Number.isInteger(nextLevel) && nextLevel >= 1 && nextLevel <= 100;
    const changed = nextLevel !== value;
    useEffect(() => onEditingChange?.(changed), [changed, onEditingChange]);
    function step(direction: -1 | 1) {
        const current = valid ? nextLevel : value;
        setLevel(String(Math.max(1, Math.min(100, current + direction))));
        setError(null);
    }
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (disabled || busy || !valid || !changed) return;
        setError(null);
        setBusy(true);
        try {
            await onSave(nextLevel);
        } catch {
            setError(
                t(
                    'Could not save the level. Try again.',
                    'Úroveň se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            className="my-level-editor"
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <div className="my-level-controls">
                {changed && (
                    <button
                        className="my-level-save"
                        disabled={disabled || busy || !valid}
                        type="submit"
                        aria-label={t('Save level', 'Uložit úroveň')}
                        title={t('Save level', 'Uložit úroveň')}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    </button>
                )}
                <label className="my-level-display">
                    <span aria-hidden="true">LV.</span>
                    <input
                        aria-label={t('Level', 'Úroveň')}
                        style={{ width: `${Math.max(2, Math.min(3, level.length))}ch` }}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={level}
                        onChange={(event) => {
                            setLevel(event.target.value);
                            setError(null);
                        }}
                        disabled={disabled || busy}
                    />
                </label>
                <div className="my-level-arrows">
                    <button
                        type="button"
                        aria-label={t('Increase level', 'Zvýšit úroveň')}
                        title={t('Increase level', 'Zvýšit úroveň')}
                        disabled={disabled || busy || (valid && nextLevel >= 100)}
                        onClick={() => step(1)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m6 15 6-6 6 6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        aria-label={t('Decrease level', 'Snížit úroveň')}
                        title={t('Decrease level', 'Snížit úroveň')}
                        disabled={disabled || busy || (valid && nextLevel <= 1)}
                        onClick={() => step(-1)}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </button>
                </div>
            </div>
            {error && <p role="alert">{error}</p>}
        </form>
    );
}
