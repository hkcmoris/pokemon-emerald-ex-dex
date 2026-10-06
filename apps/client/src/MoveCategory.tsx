import physicalIcon from './assets/move-categories/physical.png';
import specialIcon from './assets/move-categories/special.png';
import statusIcon from './assets/move-categories/status.png';

export function MoveCategory({ category }: { category: string }) {
    const icon =
        category === 'Physical'
            ? physicalIcon
            : category === 'Special'
              ? specialIcon
              : category === 'Status'
                ? statusIcon
                : undefined;

    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {icon && <img src={icon} alt="" className="h-6 w-7 shrink-0 object-contain" />}
            <span>{category}</span>
        </span>
    );
}
