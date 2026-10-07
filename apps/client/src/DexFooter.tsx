export function DexFooter({
    context = 'species',
}: {
    context?: 'species' | 'items' | 'abilities';
}) {
    const { t } = useLanguage();
    return (
        <footer className="mt-8 flex flex-wrap justify-between gap-3 text-xs leading-relaxed text-stone-500">
            <p>
                {context === 'abilities'
                    ? t(
                          'Ability IDs and descriptions are preserved from the ROM.',
                          'ID a popisy schopností jsou převzaty z ROM beze změn.',
                      )
                    : context === 'items'
                      ? t(
                            'Item IDs and names are preserved from the ROM.',
                            'ID a názvy předmětů jsou převzaty z ROM beze změn.',
                        )
                      : t(
                            'IDs are internal ROM species/form IDs. Forms can share a name.',
                            'ID jsou interní identifikátory druhů a forem z ROM. Různé formy mohou mít stejný název.',
                        )}
            </p>
            <a href="https://deerflow.tech" target="_blank" rel="noreferrer">
                {t('Created By Deerflow', 'Vytvořil Deerflow')}
            </a>
        </footer>
    );
}
import { useLanguage } from './language.js';
