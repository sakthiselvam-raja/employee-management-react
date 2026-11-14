import { useState } from 'react';
import { cx } from './ui';

// Put the logo file at frontend/public/ism-logo.webp. Until it exists, the hosted copy is used.
const LOCAL = '../assets/ism-logo-CKGz7RCb.webp';
import REMOTE from "../assets/ism-logo-CKGz7RCb.webp"

/**
 * ISM logo.
 * onDark: sits on a white rounded plate so it stays readable on the navy sidebar / login panel.
 */
export default function BrandLogo({ onDark = false, compact = false, className }) {
  const [src, setSrc] = useState(LOCAL);
  const img = (
    <img
      src={src}
      alt="ISM"
      className={cx('w-auto object-contain', compact ? 'h-7 max-w-36' : 'h-9 max-w-44')}
      onError={() => setSrc((s) => (s === LOCAL ? REMOTE : s))}
    />
  );
  if (!onDark) return <span className={cx('inline-flex items-center', className)}>{img}</span>;
  return <span className={cx(compact ? 'inline-flex items-center rounded-lg bg-white px-2 py-1' : 'inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-lg shadow-black/20', className)}>{img}</span>;
}