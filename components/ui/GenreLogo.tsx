import React from 'react';
import Image from 'next/image';

interface GenreLogoProps {
  className?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  withContainer?: boolean;
  containerClassName?: string;
  priority?: boolean;
}

export function GenreLogo({
  className = '',
  size = 'md',
  withContainer = false,
  containerClassName = '',
  priority = false,
}: GenreLogoProps) {
  let dimension = 36;
  if (typeof size === 'number') {
    dimension = size;
  } else {
    switch (size) {
      case 'sm':
        dimension = 24;
        break;
      case 'md':
        dimension = 36;
        break;
      case 'lg':
        dimension = 48;
        break;
      case 'xl':
        dimension = 64;
        break;
    }
  }

  const img = (
    <Image
      src="/logo-genre.png"
      alt="Logo GenRe Kabupaten Buleleng"
      width={dimension}
      height={dimension}
      className={`object-contain ${className}`}
      priority={priority}
    />
  );

  if (withContainer) {
    return (
      <div
        className={`rounded-xl bg-white p-1 border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0 ${containerClassName}`}
      >
        {img}
      </div>
    );
  }

  return img;
}
