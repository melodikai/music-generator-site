import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

const MobileMenu = ({ open, onClose, children }: Props) => (
  <div
    className={cn(
      'fixed inset-0 z-50 lg:hidden',
      open ? 'pointer-events-auto' : 'pointer-events-none',
    )}
  >
    <div
      onClick={onClose}
      className={cn(
        'absolute inset-0 bg-black/60 transition-opacity',
        open ? 'opacity-100' : 'opacity-0',
      )}
    />
    <div
      className={cn(
        'absolute inset-y-0 left-0 w-[260px] bg-background transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {children}
    </div>
  </div>
);

export default MobileMenu;
