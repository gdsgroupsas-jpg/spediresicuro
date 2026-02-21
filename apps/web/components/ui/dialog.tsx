'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Salva elemento precedentemente focalizzato
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      document.body.style.overflow = 'unset';
      // Ripristina focus all'elemento precedente
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Focus trap: Tab/Shift+Tab restano dentro il dialog
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const container = dialogRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Auto-focus primo elemento focusabile
    requestAnimationFrame(() => {
      const container = dialogRef.current;
      if (container) {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }
    });

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Content wrapper - uses flex centering instead of transform */}
      <div className="relative z-50 flex items-center justify-center w-full h-full p-4 pointer-events-none">
        {children}
      </div>
    </div>
  );
};

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  /** Use 'default' for small dialogs, 'large' for wizards/forms */
  size?: 'default' | 'large' | 'full';
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onClose, size = 'default', ...props }, ref) => {
    const sizeClasses = {
      default: 'max-w-lg',
      large: 'max-w-4xl',
      full: 'max-w-6xl',
    };

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles - pointer-events-auto to make it clickable
          'pointer-events-auto relative w-full',
          sizeClasses[size],
          // Visual styles
          'bg-white rounded-xl shadow-2xl',
          // Height constraints with proper scrolling
          'max-h-[85vh] flex flex-col',
          // Animation
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-shrink-0 flex flex-col space-y-1.5 p-6 pb-4 border-b border-gray-100',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight text-gray-900', className)}
      {...props}
    />
  )
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-gray-500 mt-1.5', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

/** Scrollable body area for dialog content */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto p-6', className)} {...props} />
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-4 border-t border-gray-100',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
};
