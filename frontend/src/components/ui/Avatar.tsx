import { cn } from '../../lib/cn'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/**
 * Deterministic tint from the name, so the same person is the same colour on
 * every screen without storing an avatar.
 */
const TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
]

function tintFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]!
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md'
  className?: string
}

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        size === 'sm' ? 'size-5 text-[10px]' : 'size-7 text-xs',
        tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
