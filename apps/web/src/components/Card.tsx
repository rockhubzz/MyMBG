import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  shadow?: 'sm' | 'md' | 'lg';
}

const shadowClasses: Record<string, string> = {
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
};

export function Card({ children, className = '', shadow = 'md' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl p-6 border border-gray-100 ${shadowClasses[shadow]} ${className}`}>
      {children}
    </div>
  );
}
