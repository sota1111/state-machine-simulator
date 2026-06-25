import { test, expect } from '@playwright/test'
import { mockApi, login, MACHINE, SAMPLE_MACHINE } from './support/mockApi'

// ユーザー操作→画面遷移/表示を検証するシナリオe2e（SOT-1260 / 親 SOT-1258）。
// 1シナリオ = 1ユーザーストーリー。すべての `/api/**` は support/mockApi で決定的にモックする。

test('一覧→詳細→タブ切替: モデルカードから詳細を開きパネルタブを切り替えられる', async ({ page }) => {
  await mockApi(page)
  await login(page)

  // ログイン直後は一覧（/）。自作モデルのカードが見える。
  await expect(page).toHaveURL(/\/$/)
  const detailLink = page.locator(`a[href="/models/${MACHINE.id}"]`)
  await expect(detailLink).toBeVisible()

  // 詳細へ遷移。
  await detailLink.click()
  await expect(page).toHaveURL(new RegExp(`/models/${MACHINE.id}`))
  await expect(page.getByRole('heading', { name: MACHINE.name, level: 1 })).toBeVisible()

  // 既定タブはシミュレーション。網羅性タブへ切替えるとそのパネルが表示される。
  await page.getByTestId('tab-coverage').click()
  await expect(page.locator('#panel-coverage')).not.toHaveClass(/hidden/)
  await expect(page.locator('#panel-review')).toHaveClass(/hidden/)

  // 仕様レビュータブへ切替えると入れ替わる。
  await page.getByTestId('tab-review').click()
  await expect(page.locator('#panel-review')).not.toHaveClass(/hidden/)
  await expect(page.locator('#panel-coverage')).toHaveClass(/hidden/)
})

test('新規作成（入力→解析）: AI入力を解析すると解析結果が表示される', async ({ page }) => {
  await mockApi(page)
  await login(page)

  await page.locator('a[href="/input"]').first().click()
  await expect(page).toHaveURL(/\/input/)

  // AIモードのテキストエリアに入力し「解析」する。
  await page.locator('textarea').first().fill('注文を受け付けて発送し完了する')
  await page.getByTestId('parse-submit').click()

  // 解析結果カード（保存ボタン）が現れる。
  await expect(page.getByTestId('save-parsed')).toBeVisible()
})

test('新規作成→保存→詳細: 解析結果を保存すると詳細ページへ遷移する', async ({ page }) => {
  await mockApi(page)
  await login(page)

  await page.locator('a[href="/input"]').first().click()
  await page.locator('textarea').first().fill('注文を受け付けて発送し完了する')
  await page.getByTestId('parse-submit').click()

  const save = page.getByTestId('save-parsed')
  await expect(save).toBeVisible()
  await save.click()

  // 作成後は新規モデルの詳細ページへ遷移する（POST /models/ は id=m-created を返す）。
  await expect(page).toHaveURL(/\/models\/m-created/)
  await expect(page.getByRole('heading', { name: MACHINE.name, level: 1 })).toBeVisible()
})

test('一覧 自作/テンプレート切替: タブを切り替えると対応するモデルが表示される', async ({ page }) => {
  // 自作は空、テンプレートにサンプルを1件用意する。
  await mockApi(page, { mineModels: [], sampleModels: [SAMPLE_MACHINE] })
  await login(page)

  // 自作タブ（既定）はモデルカードなし。
  await expect(page.locator(`a[href="/models/${SAMPLE_MACHINE.id}"]`)).toHaveCount(0)

  // テンプレートタブへ切替えるとサンプルのカードが表示される。
  await page.getByTestId('view-sample').click()
  await expect(page.locator(`a[href="/models/${SAMPLE_MACHINE.id}"]`)).toBeVisible()
})
