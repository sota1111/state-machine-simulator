import { expect, type Page } from '@playwright/test'

// バックエンドは起動せず、ブラウザ層で `/api/**` をすべて横取りして決定的なレスポンスを返す（SOT-1154）。
// シナリオspec間でモックとログイン手順を共通化する（SOT-1260 / 親 SOT-1258）。

type StateLite = { name: string; description: string; is_terminal: boolean }
type TransitionLite = { from_state: string; to_state: string; event: string }

interface MachineLite {
  id: string
  name: string
  description: string
  initial_state: string
  is_sample: boolean
  states: StateLite[]
  transitions: TransitionLite[]
}

// StateDiagram は transition の from/to を state の id に解決するため、id = state 名 とする
// （InputPage の previewMachine と同じ方針）。
function toMachine(m: MachineLite) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    initial_state: m.initial_state,
    is_sample: m.is_sample,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    states: m.states.map(s => ({
      id: s.name,
      machine_id: m.id,
      name: s.name,
      description: s.description,
      is_terminal: s.is_terminal,
    })),
    transitions: m.transitions.map((tr, i) => ({
      id: `${m.id}-t${i}`,
      machine_id: m.id,
      from_state: tr.from_state,
      to_state: tr.to_state,
      event: tr.event,
    })),
  }
}

const ORDER_STATES: StateLite[] = [
  { name: '受付', description: '注文を受け付ける', is_terminal: false },
  { name: '発送', description: '商品を発送する', is_terminal: false },
  { name: '完了', description: '取引完了', is_terminal: true },
]
const ORDER_TRANSITIONS: TransitionLite[] = [
  { from_state: '受付', to_state: '発送', event: '出荷指示' },
  { from_state: '発送', to_state: '完了', event: '配達完了' },
]

export const MACHINE: MachineLite = {
  id: 'm1',
  name: '注文フロー',
  description: '注文受付から完了までのフロー',
  initial_state: '受付',
  is_sample: false,
  states: ORDER_STATES,
  transitions: ORDER_TRANSITIONS,
}

export const SAMPLE_MACHINE: MachineLite = {
  id: 's1',
  name: 'サンプル承認フロー',
  description: 'テンプレート',
  initial_state: '受付',
  is_sample: true,
  states: ORDER_STATES,
  transitions: ORDER_TRANSITIONS,
}

const CREATED_MACHINE: MachineLite = { ...MACHINE, id: 'm-created' }

// POST /parse/ が返す ParseResponse（AI解析結果）。
export const PARSED = {
  name: '注文フロー',
  description: 'AI が解析したフロー',
  initial_state: '受付',
  states: ORDER_STATES,
  transitions: ORDER_TRANSITIONS,
  events: ['出荷指示', '配達完了'],
}

const ANALYSIS = {
  unreachable_states: [],
  terminal_states: ['完了'],
  undefined_events: [],
  state_count: 3,
  transition_count: 2,
  simulation_run_count: 0,
}

export interface MockOpts {
  authed?: boolean
  mineModels?: MachineLite[]
  sampleModels?: MachineLite[]
}

export async function mockApi(page: Page, opts: MockOpts = {}) {
  const authed = opts.authed ?? true
  const mineModels = opts.mineModels ?? [MACHINE]
  const sampleModels = opts.sampleModels ?? [SAMPLE_MACHINE]

  const json = (route: Parameters<Parameters<Page['route']>[1]>[0], body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route('**/api/**', async route => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const pathname = url.pathname

    if (pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: authed ? 200 : 401, contentType: 'application/json', body: '{}' })
      return
    }
    if (pathname.endsWith('/auth/session') || pathname.endsWith('/auth/logout')) {
      await json(route, {})
      return
    }

    // POST /parse/ （AI解析）
    if (method === 'POST' && /\/parse\/?$/.test(pathname)) {
      await json(route, PARSED)
      return
    }

    // /models/ コレクション
    if (/\/models\/?$/.test(pathname)) {
      if (method === 'POST') {
        await json(route, toMachine(CREATED_MACHINE))
        return
      }
      const isSample = url.searchParams.get('is_sample') === 'true'
      const list = isSample ? sampleModels : mineModels
      await json(route, list.map(toMachine))
      return
    }

    // /models/:id/analysis
    if (/\/models\/[^/]+\/analysis$/.test(pathname)) {
      await json(route, ANALYSIS)
      return
    }
    // /models/:id/history | /versions → 空
    if (/\/models\/[^/]+\/(history|versions)$/.test(pathname)) {
      await json(route, [])
      return
    }
    // /models/:id （単体取得）。id をそのまま使ったマシンを返す。
    const single = pathname.match(/\/models\/([^/]+)$/)
    if (method === 'GET' && single) {
      await json(route, toMachine({ ...MACHINE, id: single[1] }))
      return
    }

    // その他は空配列
    await json(route, [])
  })
}

// このアプリは auth/me 解決前に /login へバウンスするため、ログインフォームから認証する。
export async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('test@example.com')
  await page.locator('input[type="password"]').fill('password123')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('a[href="/input"]').first()).toBeVisible()
}
