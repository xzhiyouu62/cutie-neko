import { expect, test } from 'claude-code/testing'

test('the band draws the cat as a grid of cells on the terminal', async ($, on) => {
  on('command.register', () => ({ value: { command: 'cat' } }))
  on('store.get', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'cutie-neko',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'terminal',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  })
  const raster = await ui.find({ type: 'Raster' })
  const props = (raster as unknown as { props: { cells: string; columns: number; rows: number } }).props
  expect(props.columns).toBe(80)
  expect(props.rows).toBe(6)
  const bytes = Uint8Array.from(atob(props.cells), c => c.charCodeAt(0))
  expect(bytes.length).toBe(80 * 6 * 12)
  const u = new Uint32Array(bytes.buffer)
  let text = ''
  for (let i = 0; i < 80 * 6; i++) text += String.fromCodePoint(u[i * 3] ?? 32)
  expect(text).toContain('\u2580')
  await ui.unmount()
})
