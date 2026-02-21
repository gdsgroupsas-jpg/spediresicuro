'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

const useDropdownMenu = () => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('useDropdownMenu must be used within a DropdownMenu');
  }
  return context;
};

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-menu]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block" data-dropdown-menu>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ className, children, asChild, ...props }, ref) => {
    const { isOpen, setIsOpen } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
      props.onClick?.(e);
    };

    // asChild: clona il figlio diretto passandogli le prop del trigger
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          handleClick(e);
          (children as React.ReactElement<any>).props.onClick?.(e);
        },
        'aria-expanded': isOpen,
        'aria-haspopup': 'menu' as const,
      });
    }

    return (
      <button
        ref={ref}
        className={cn('outline-none', className)}
        onClick={handleClick}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = 'end', sideOffset = 4, children, ...props }, ref) => {
    const { isOpen, setIsOpen } = useDropdownMenu();

    if (!isOpen) return null;

    const alignClasses = {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'absolute z-50 min-w-[8rem] overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg',
          'animate-in fade-in-0 zoom-in-95',
          alignClasses[align],
          className
        )}
        style={{ marginTop: sideOffset }}
        role="menu"
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
  destructive?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, destructive, children, ...props }, ref) => {
    const { setIsOpen } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(e);
      setIsOpen(false);
    };

    return (
      <button
        ref={ref}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm font-medium outline-none transition-colors',
          'text-gray-900 hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900',
          destructive &&
            'text-red-700 hover:bg-red-50 hover:text-red-800 focus:bg-red-50 focus:text-red-800',
          inset && 'pl-8',
          'disabled:pointer-events-none disabled:opacity-50 disabled:text-gray-400',
          className
        )}
        role="menuitem"
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('-mx-1 my-1 h-px bg-gray-200', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider',
        className
      )}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
