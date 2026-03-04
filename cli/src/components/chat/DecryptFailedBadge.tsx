import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface DecryptFailedBadgeProps {
  className?: string;
}

export const DecryptFailedBadge: React.FC<DecryptFailedBadgeProps> = ({ className }) => {
  const { t } = useTranslation();
  return (
    <div className={cn('text-[14px] font-black text-orange-500 uppercase tracking-wider', className)}>
      {t('chat.decryptFailed')}
    </div>
  );
};
