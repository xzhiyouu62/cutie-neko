import type { Register } from 'claude-code'

const KEY = 'cat'
const ROWS = 6 // cells; each cell holds two pixels, one above the other
const CAT = 18 // the cat's width in pixels and in cells
const DEFAULT = 0x01000000 // the terminal's own color
const FISH = 0x6ec6ff

// One letter a pixel: W white fur, S shaded fur, E eye, . nothing
const INK: Record<string, number> = { W: 0xf7f7f7, S: 0xbfc4d2, E: 0x35a7ff }

// Side view, facing right: two steps of the walk, then sitting, eyes open and shut
const WALK_A = [
  '.............W...W',
  '.............WS.SW',
  'W............WWWWW',
  'W............WEWEW',
  'W............WWWWW',
  '.W..WWWWWWWWWWWWW.',
  '.WWWWWWWWWWWWWWW..',
  '..WWWWWWWWWWWWWW..',
  '..WWWWWWWWWWWWW...',
  '..WW.S....S.WW....',
  '.WW...S..S...WW...',
  '.WW...S..S...WW...',
]
const WALK_B = [
  '.............W...W',
  '.............WS.SW',
  '.W...........WWWWW',
  'W............WEWEW',
  'W............WWWWW',
  '.W..WWWWWWWWWWWWW.',
  '.WWWWWWWWWWWWWWW..',
  '..WWWWWWWWWWWWWW..',
  '..WWWWWWWWWWWWW...',
  '...WWS....SWW.....',
  '...WWS....SWW.....',
  '...WW......WW.....',
]
const SIT = [
  '.............W...W',
  '.............WS.SW',
  '.............WWWWW',
  '.............WEWEW',
  '.............WWWWW',
  '..........WWWWWWW.',
  '.........WWWWWWWW.',
  '........WWWWWWWWW.',
  '........WWWWWWWWW.',
  '........WWWWWWWWW.',
  '..W.....WWWWWWWWW.',
  '...WWWWWWWWWWWSWW.',
]
const SHUT = [
  '.............W...W',
  '.............WS.SW',
  '.............WWWWW',
  '.............WSWSW',
  '.............WWWWW',
  '..........WWWWWWW.',
  '.........WWWWWWWW.',
  '........WWWWWWWWW.',
  '........WWWWWWWWW.',
  '........WWWWWWWWW.',
  '..W.....WWWWWWWWW.',
  '...WWWWWWWWWWWSWW.',
]

const WORDS = [
  'Chasing the red dot',
  'Kneading the blanket',
  'Knocking things off the desk',
  'Stalking a bug',
  'Grooming whiskers',
  'Purring',
  'Batting at yarn',
  'Sitting in the box',
  'Watching birds',
  'Stretching',
]
const DONE = ['Purred for', 'Napped for', 'Prowled for', 'Pounced after', 'Groomed for']

const mirror = (sprite: string[]) => sprite.map(row => [...row].reverse().join(''))
const LEFT = new Map([WALK_A, WALK_B, SIT, SHUT].map(sprite => [sprite, mirror(sprite)]))

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | (b >> 4)]
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '='
    out += i + 2 < bytes.length ? B64[c & 63] : '='
  }
  return out
}

const pick = (list: string[], seed: string) => {
  let n = 0
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return list[n % list.length] ?? seed
}

type Mood = 'walk' | 'sit' | 'eat'

export const register: Register = on => {
  let isOn = true
  let isShown = false
  let site: string | undefined
  let width = 0
  let tick = 0
  // the cat: its left edge, where it is headed, what it is doing and for how long
  let x = 2
  let goal = 2
  let facing: 1 | -1 = 1
  let mood: Mood = 'walk'
  let left = 0
  let fish: number[] = []
  let eaten = 0

  const sprite = (): string[] => {
    const right = mood === 'walk' ? (tick % 6 < 3 ? WALK_A : WALK_B) : mood === 'eat' || tick % 30 >= 28 ? SHUT : SIT
    return facing === 1 ? right : (LEFT.get(right) ?? right)
  }

  const frame = (): string => {
    const words = new Uint32Array(width * ROWS * 3)
    for (let i = 0; i < width * ROWS; i++) {
      words[i * 3] = 0x20
      words[i * 3 + 1] = DEFAULT
      words[i * 3 + 2] = DEFAULT
    }
    for (const at of fish) {
      ;[...'><>'].forEach((ch, i) => {
        if (at + i >= width) return
        const cell = ((ROWS - 1) * width + at + i) * 3
        words[cell] = ch.charCodeAt(0)
        words[cell + 1] = FISH
      })
    }
    // two pixels to a cell: the upper half block in the top pixel's color, over the bottom pixel's
    const art = sprite()
    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < CAT; i++) {
        const col = x + i
        if (col < 0 || col >= width) continue
        const top = INK[art[row * 2]?.[i] ?? '.']
        const bottom = INK[art[row * 2 + 1]?.[i] ?? '.']
        if (top === undefined && bottom === undefined) continue
        const cell = (row * width + col) * 3
        if (top !== undefined) {
          words[cell] = 0x2580
          words[cell + 1] = top
          words[cell + 2] = bottom ?? DEFAULT
        } else {
          words[cell] = 0x2584
          words[cell + 1] = bottom ?? DEFAULT
          words[cell + 2] = DEFAULT
        }
      }
    }
    return base64(new Uint8Array(words.buffer))
  }

  const walkTo = (to: number) => {
    goal = Math.max(0, Math.min(width - CAT, to))
    mood = 'walk'
  }

  const step = () => {
    tick += 1
    // a fish on the floor comes first
    const near = fish.length === 0 ? undefined : fish.reduce((a, b) => (Math.abs(a - x) <= Math.abs(b - x) ? a : b))
    if (near !== undefined && mood !== 'eat') walkTo(near - (near > x ? CAT - 2 : 0))
    if (mood === 'walk') {
      if (x !== goal) {
        facing = goal > x ? 1 : -1
        x += facing
      } else if (near !== undefined) {
        fish = fish.filter(at => at !== near)
        eaten += 1
        mood = 'eat'
        left = 12
      } else if (Math.random() < 0.3) {
        // a short rest now and then
        mood = 'sit'
        left = 15 + Math.floor(Math.random() * 30)
      } else {
        walkTo(Math.floor(Math.random() * Math.max(1, width - CAT)))
      }
      return
    }
    left -= 1
    if (left <= 0) walkTo(Math.floor(Math.random() * Math.max(1, width - CAT)))
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'cat', description: 'Let the cat out, or put it away' })
    isOn = (await $.store.get('isOn')) !== false
    $.clock.every(110, () => {
      if (!isOn || !isShown || site === undefined || width === 0) return
      step()
      void $.ui.blit({ requestId: site, key: KEY, columns: width, rows: ROWS, cells: frame() }).catch(() => undefined)
    })
    return next(e)
  })

  on('command.run', { command: 'cat' }, async $ => {
    isOn = !isOn
    await $.store.set('isOn', isOn)
    $.ui.invalidate('ui.render')
    return { text: isOn ? `the cat is out (fish eaten so far: ${eaten})` : 'the cat went to bed' }
  })

  // every tool call drops a fish for the cat
  on('tool.call', ($, e, next) => {
    if (isOn && width > 30 && fish.length < 4) fish.push(3 + Math.floor(Math.random() * (width - 8)))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    isShown = false
    if (!isOn || e.props.hasSurvey) return next(e)
    const w = Math.min(512, Math.floor(e.props.bodyColumns))
    if (w < CAT + 6 || e.props.maxRows < ROWS) return next(e)
    if (w !== width) {
      width = w
      x = Math.min(x, width - CAT)
      goal = Math.min(goal, width - CAT)
      fish = fish.filter(at => at < width - 4)
    }
    site = e.requestId
    isShown = !e.props.isCollapsed
    const { Raster } = $.ui.resolve(e)
    return Raster({ key: KEY, columns: width, rows: ROWS, cells: frame() })
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (!isOn || e.props.message !== null) return next(e)
    return next({ ...e, props: { ...e.props, word: pick(WORDS, e.props.word), suffix: ' =^.^=' } })
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => {
    if (!isOn) return next(e)
    return next({ ...e, props: { ...e.props, word: pick(DONE, e.props.word) } })
  })

  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    if (!isOn) return next(e)
    return next({ ...e, props: { ...e.props, tail: ' ~ meow' } })
  })
}
