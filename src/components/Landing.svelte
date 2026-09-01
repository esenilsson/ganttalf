<script>
  import DropZone from './DropZone.svelte'
  import ChartList from './ChartList.svelte'

  // Pastels carry category — one swatch per feature, same job as in the plan
  const features = [
    {
      swatch: 'bg-gt-cat-ice',
      title: 'Drag to edit',
      text: 'Move bars, stretch edges, and slide milestones directly on the chart — or type in the table below it.',
    },
    {
      swatch: 'bg-gt-cat-aqua',
      title: 'Never lose work',
      text: 'Everything autosaves locally as you edit. Sign in with Google or GitHub to keep charts in the cloud.',
    },
    {
      swatch: 'bg-gt-cat-lemon',
      title: 'Share with a link',
      text: 'Live links always show your latest saved version, read-only. Snapshot links freeze the chart in the URL itself.',
    },
    {
      swatch: 'bg-gt-cat-peach',
      title: 'Export anywhere',
      text: 'PowerPoint with editable native shapes, plus Excel, PNG, and SVG. Round-trip back to Excel any time.',
    },
  ]

  // Static workspace preview — monochrome ink, like the real plan canvas
  const mockWeeks = ['W27', 'W29', 'W31', 'W33', 'W35', 'W37']
  const mockRows = [
    { name: 'Leave the Shire', off: 6, w: 20, note: '6d' },
    { name: 'Road to Rivendell', off: 22, w: 26, note: '9d' },
    { name: 'Mines of Moria', off: 40, w: 24, note: '8d' },
    { name: 'Pass of Cirith Ungol', off: 58, w: 22, note: 'At risk' },
    { name: 'Mount Doom', off: 80, milestone: true, note: 'Milestone', critical: true },
  ]

  // One-shot slide-in from the left once a row scrolls into view; never
  // reverses on scroll-up. Motion is skipped for prefers-reduced-motion.
  function reveal(node, delay = 0) {
    node.style.transitionDelay = `${delay}ms`
    node.classList.add('reveal-init')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('reveal-in')
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(node)
    return { destroy: () => io.disconnect() }
  }
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 pb-16 pt-6 sm:pt-12">
  <div class="flex flex-col items-center gap-5 text-center">
    <span class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gt-brick-500">
      Free · no account needed · open source
    </span>
    <h2 class="max-w-3xl text-balance font-display text-[40px] font-medium leading-[1.02] tracking-[-0.015em] sm:text-[58px]">
      A project is never late,
      <span class="text-gt-brick-500">nor is it early</span>
    </h2>
    <p class="max-w-xl text-balance text-[15px] leading-[1.6] text-gt-ink-muted">
      It ships precisely when you plan it to. Drop a spreadsheet, drag bars and
      milestones into place, then export to PowerPoint, PNG, or SVG.
    </p>
  </div>

  <div class="w-full max-w-2xl">
    <DropZone />
  </div>

  <ChartList />

  <div class="h-px w-full bg-gt-ink"></div>

  <!-- Workspace preview — drawn in CSS, no bitmaps -->
  <figure class="w-full" aria-label="The ganttalf workspace">
    <div class="overflow-hidden rounded-xl border border-gt-line bg-gt-paper shadow-sm">
    <div class="flex items-center justify-between gap-5 border-b border-gt-line bg-gt-rail px-4 py-2.5">
      <div class="flex items-center gap-3">
        <span class="text-[15px] font-bold tracking-tight">🧙 Ganttalf</span>
        <span class="h-[18px] w-px bg-gt-line"></span>
        <span class="text-[13px] text-gt-ink-muted">Q3 roadmap</span>
      </div>
      <span class="rounded-md bg-gt-brick-500 px-3 py-1.5 text-xs font-medium text-white">Add task</span>
    </div>
    <div class="grid grid-cols-[minmax(150px,240px)_1fr]">
      <div class="border-r border-gt-line">
        <div class="border-b border-gt-line px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gt-ink-faint">Task</div>
        {#each mockRows as r, i (r.name)}
          <div
            class="flex h-11 items-center gap-2 truncate px-4 text-[13px] {r.critical ? 'font-semibold' : ''} {i < mockRows.length - 1 ? 'border-b border-gt-line-soft' : ''}"
          >
            <span class="h-2.5 w-2.5 shrink-0 bg-gt-ink" use:reveal={i * 90}></span>{r.name}
          </div>
        {/each}
      </div>
      <div>
        <div class="grid grid-cols-6 border-b border-gt-line">
          {#each mockWeeks as w, i (w)}
            <div class="px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gt-ink-faint {i < mockWeeks.length - 1 ? 'border-r border-gt-line-soft' : ''}">{w}</div>
          {/each}
        </div>
        {#each mockRows as r, i (r.name)}
          <div class="flex h-11 items-center px-3 {i < mockRows.length - 1 ? 'border-b border-gt-line-soft' : ''}">
            <div style="width: {r.off}%"></div>
            {#if r.milestone}
              <div class="h-0 w-0 border-b-[16px] border-l-[9px] border-r-[9px] border-b-gt-ink border-l-transparent border-r-transparent" use:reveal={i * 90}></div>
            {:else}
              <div class="h-[18px] bg-gt-ink" style="width: {r.w}%" use:reveal={i * 90}></div>
            {/if}
            <div class="ml-2 text-[11px] text-gt-ink-faint" use:reveal={i * 90}>{r.note}</div>
          </div>
        {/each}
      </div>
    </div>
    </div>
    <figcaption class="px-1 pt-3 text-center text-[11px] text-gt-ink-muted">
      Ink on white — every bar, edge and milestone drags directly on the canvas.
    </figcaption>
  </figure>

  <div class="h-px w-full bg-gt-ink"></div>

  <div class="grid w-full gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
    {#each features as f (f.title)}
      <div class="flex flex-col gap-2 rounded-xl bg-gt-paper p-5 shadow-sm">
        <div class="h-2.5 w-2.5 rounded-[2px] {f.swatch}"></div>
        <h3 class="font-display text-[22px] font-medium leading-tight">{f.title}</h3>
        <p class="text-[13px] leading-relaxed text-gt-ink-muted">{f.text}</p>
      </div>
    {/each}
  </div>

  <p class="text-center text-[11px] text-gt-ink-muted">
    Your data stays yours — anonymous charts never leave the browser.
    Ganttalf is open source on
    <a href="https://github.com/esenilsson/ganttalf" target="_blank" rel="noopener" class="font-semibold text-gt-ink underline underline-offset-2 hover:text-gt-brick-500">GitHub</a>.
  </p>
</div>

<style>
  :global(.reveal-init) {
    opacity: 0;
    transform: translateX(-24px);
    transition:
      opacity 400ms ease-out,
      transform 400ms ease-out;
  }
  :global(.reveal-in) {
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.reveal-init) {
      transition: none;
      transform: none;
      opacity: 1;
    }
  }
</style>
