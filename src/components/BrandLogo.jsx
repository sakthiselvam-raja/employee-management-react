import { useState } from 'react';
import { cx } from './ui';
import logImg from "../assets/ism-logo-CKGz7RCb.webp"

export default function BrandLogo({ onDark = false, className }) {
  const img = (
    <img
      src={logImg}
      alt="ISM"
      className="h-9 w-auto max-w-44 object-contain"
      
    />
  );
  if (!onDark) return <span className={cx('inline-flex items-center', className)}>{img}</span>;
  return <span className={cx('inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-lg shadow-black/20', className)}>{img}</span>;
}