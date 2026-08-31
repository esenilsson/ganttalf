<script>
  let {
    variant = 'default',
    size = 'default',
    class: className = '',
    children,
    ...rest
  } = $props()

  // Brick carries the one primary action per view; everything else stays
  // neutral. Labels are Archivo 800 uppercase per the brand handoff.
  const variants = {
    default: 'bg-gt-brick-500 text-white hover:bg-gt-brick-600 active:bg-gt-brick-700',
    secondary: 'border border-gt-line bg-gt-rail text-gt-ink hover:bg-gt-line-soft',
    outline: 'border border-gt-line bg-gt-paper text-gt-ink hover:bg-gt-line-soft',
    ghost: 'text-gt-ink hover:bg-gt-line',
    destructive: 'bg-gt-brick-500 text-white hover:bg-gt-brick-600 active:bg-gt-brick-700',
  }
  const sizes = {
    default: 'h-9 px-4 text-[11px]',
    sm: 'h-8 px-3 text-[10px]',
    icon: 'h-8 w-8 text-sm normal-case tracking-normal',
  }
</script>

<button
  class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-extrabold uppercase tracking-[0.1em] transition-colors duration-[120ms] ease-out disabled:pointer-events-none disabled:opacity-50 {variants[variant]} {sizes[size]} {className}"
  {...rest}
>
  {@render children?.()}
</button>
