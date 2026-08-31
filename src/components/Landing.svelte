<script>
  import DropZone from './DropZone.svelte'
  import screenshot from '../assets/screenshot.png'

  const features = [
    {
      icon: '📊',
      title: 'Drag to edit',
      text: 'Move bars, stretch edges, and slide milestones directly on the chart — or type in the table below it.',
    },
    {
      icon: '💾',
      title: 'Never lose work',
      text: 'Everything autosaves locally as you edit. Sign in with Google or GitHub to keep charts in the cloud.',
    },
    {
      icon: '🔗',
      title: 'Share with a link',
      text: 'Live links always show your latest saved version, read-only. Snapshot links freeze the chart in the URL itself.',
    },
    {
      icon: '📤',
      title: 'Export anywhere',
      text: 'PowerPoint with editable native shapes, plus Excel, PNG, and SVG. Round-trip back to Excel any time.',
    },
  ]
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 pb-16 pt-6 sm:pt-12">
  <div class="flex flex-col items-center gap-5 text-center">
    <span class="rounded-full border border-border bg-secondary px-3.5 py-1 text-xs font-medium text-muted-foreground">
      Free · no account needed · open source
    </span>
    <h2 class="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
      Beautiful Gantt charts,
      <span class="bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-500 bg-clip-text text-transparent">straight from Excel</span>
    </h2>
    <p class="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
      Drop a spreadsheet, drag bars and milestones into place, then export a
      polished chart to PowerPoint, PNG, or SVG — or share it with a link.
    </p>
  </div>

  <div class="w-full max-w-2xl">
    <DropZone />
  </div>

  <figure class="relative w-full">
    <div class="absolute -inset-x-8 -top-10 bottom-10 -z-10 bg-gradient-to-r from-indigo-100 via-sky-100 to-teal-100 opacity-60 blur-3xl"></div>
    <div class="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-slate-900/15">
      <img src={screenshot} alt="Ganttalf editing a sample project plan" class="w-full" />
    </div>
  </figure>

  <div class="grid w-full gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
    {#each features as f (f.title)}
      <div class="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div class="text-2xl">{f.icon}</div>
        <h3 class="text-sm font-semibold">{f.title}</h3>
        <p class="text-sm text-muted-foreground">{f.text}</p>
      </div>
    {/each}
  </div>

  <p class="text-center text-xs text-muted-foreground">
    Your data stays yours — anonymous charts never leave the browser.
    Ganttalf is open source on
    <a href="https://github.com/esenilsson/ganttalf" target="_blank" rel="noopener" class="font-medium underline underline-offset-2 hover:text-foreground">GitHub</a>.
  </p>
</div>
