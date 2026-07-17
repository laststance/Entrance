# 録画 2026-07-17 22:27 — corelive/src 実行コード対応表

- **録画ID**: `01KXR45HTQJKN2YBYV72G3FTTK`
- **録画名**: 録画 2026-07-17 22:27  （http://localhost:4991/）
- **生成方式**: Mode B 決定論的再実行 + V8 precise coverage、録画グラウンドトゥルース照合 (`modeB-precise-coverage`)
- **生成日時**: 2026-07-17T20:26:10.504Z
- **録画長**: 00:59.17 (59170ms) / t0Mono=14562.249042
- **統計**: 実行app行 **6125** 行 / **142** ファイル / スクリプト解決 139/202

## 完全性の証明（反証テスト: 録画 ⊆ 対応表）

録画そのものが corelive/src の実行/可視を**直接**証明できる行の集合を3つの独立オラクルで確定し、その全てが本表に含まれることを機械照合した（`scripts/verify-against-recording.mjs`）。

- **録画直接証拠のある corelive/src 行**: 233 行 / 34 ファイル
  - C（cpuprofile 実サンプル＝実行された）: 54 行
  - V（rrweb data-insp-path＝画面に映っていた）: 179 行
  - S（console/error スタックアンカー）: 0 行
- これらのうち Mode B client coverage に含まれる行: 230（下記 server-rendered 3行を除く全て）
- **照合結果**: 録画直接証拠のある行で本表に欠落しているものは **0**（server component の client 未実行行は §4 に honest union 済み）。

> 証拠凡例: **M**=Mode B 決定論的再実行(V8 precise) / **C**=録画 cpuprofile 実サンプル / **V**=rrweb 可視DOM / **S**=録画スタックアンカー。M のみの行は「録画を忠実に再実行した際に実行された」ことを意味し、C/V/S が付く行は「録画そのものが直接証明する」ことを意味する。

## 正直性に関する注記 (decision 11)

- タイムスタンプは録画クロック REC（`tMono - t0Mono`）。`≈` 付き区間は再実行の待機内 500ms 刻み取得の**比例推定**。C/V/S 列の時刻は録画の実タイムスタンプ（サンプル/可視化の初出）。
- V8 precise coverage はブロック粒度 — 再実行で実行された行の**完全な集合**を保証する（サンプリング欠落なし）。
- 「ロード」区間のコードは録画開始時に既に開いていたページの起動相当実行（再実行によるブート）を含む。
- **server component の境界**: `src/app/layout.tsx`・`src/app/(main)/layout.tsx` はサーバー側でレンダリングされ、client JS は実行されない（decision 2: client JS のみ）。したがって「録画に含まれる」= rrweb がスタンプした**ホスト要素の行のみ**（サーバー実行そのものは client 録画に写らない）。該当行は §4 に可視化時刻付きで honest union。
- **sourcemap index 欠落**: 録画時 finalize で 1 チャンク（`src_app_(main)_layout_tsx_1bsospy._.js`）のマップが取得できず。いずれも0サンプルまたは server-layout の module 包み（`(anon)` glue）で、corelive/src の実関数の欠落ではない（cpuprofile 解決診断で確認）。
- 再実行用に 25 資産を byte 非同一（機能同一）のフレッシュビルドで代替（`backfill.json`）。該当チャンクは対応する fresh sourcemap で解決済み。
- 再実行時 divergence 1 件（正直に surface、決して silently wrong にしない）:
  - [network] 録画にないリクエスト: POST http://localhost:4991/api/orpc/category/list (XHR)
- 照合オラクル健全性: cpuprofile app-chunk ノード解決 63/76（未解決は生成グルー）、スタックフレーム走査 50（うち corelive 0＝録画コンソールは全てフレームワーク起点）。

## 1. 録画直接証拠テーブル（C/V/S — 録画そのものが証明する行）

この表の全行が §2/§3 または §4 に含まれる。ここに載る行こそ「録画に含まれている」と機械的に断定できる corelive/src の行である。

| ファイル | 行 | 証拠 | 録画時刻(REC) |
|---|---|---|---|
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 45 | C | 00:22.28 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 55 | C | 00:22.28 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 69 | C | 00:25.24 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 76 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 107 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 109 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 113 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 120 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 125 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 131 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 135 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 137 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 141 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 149 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 153 | V | 00:22.29 |
| `src/app/(main)/home/_components/AddTodoForm.tsx` | 157 | V | 00:22.29 |
| `src/app/(main)/home/_components/Category.tsx` | 57 | C | 00:14.54 |
| `src/app/(main)/home/_components/Category.tsx` | 110 | C | 00:40.03 |
| `src/app/(main)/home/_components/Category.tsx` | 134 | C | 00:40.03 |
| `src/app/(main)/home/_components/Category.tsx` | 147 | V | 00:14.55 |
| `src/app/(main)/home/_components/Category.tsx` | 150 | V | 00:14.55 |
| `src/app/(main)/home/_components/Category.tsx` | 154 | V | 00:14.55 |
| `src/app/(main)/home/_components/Category.tsx` | 158 | V | 00:32.50 |
| `src/app/(main)/home/_components/Category.tsx` | 159 | V | 00:32.50 |
| `src/app/(main)/home/_components/Category.tsx` | 169 | V | 00:32.50 |
| `src/app/(main)/home/_components/Category.tsx` | 171 | V | 00:32.50 |
| `src/app/(main)/home/_components/Category.tsx` | 185 | V | 00:32.50 |
| `src/app/(main)/home/_components/Category.tsx` | 196 | V | 00:14.55 |
| `src/app/(main)/home/_components/Category.tsx` | 197 | V | 00:14.55 |
| `src/app/(main)/home/_components/CategoryManageDialog.tsx` | 53 | C | 00:14.54 |
| `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 47 | C | 00:55.76 |
| `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 82 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 83 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 66 | C | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 190 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 195 | V | 00:29.43 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 196 | V | 00:29.43 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 271 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 272 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 273 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 274 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 277 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 286 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 287 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 288 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 314 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodos.tsx` | 318 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 68 | C | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 106 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 124 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 131 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 138 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 156 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 163 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 168 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 297 | V | 00:22.29 |
| `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 302 | V | 00:22.29 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 188 | C | 00:29.41 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 234 | C | 00:29.41 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 272 | C | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 285 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 336 | V | 00:22.29 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 337 | V | 00:22.29 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 340 | V | 00:22.29 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 348 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 349 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 351 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 353 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 355 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 356 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 358 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 375 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 376 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 378 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 384 | V | 00:29.42 |
| `src/app/(main)/home/_components/ContributionGraph.tsx` | 580 | C | 00:29.43 |
| `src/app/(main)/home/_components/DayDetailDialog.tsx` | 177 | C | 00:29.40 |
| `src/app/(main)/home/_components/DayDetailDialog.tsx` | 195 | C | 00:29.40 |
| `src/app/(main)/home/_components/TodoList.tsx` | 117 | C | 00:14.55 |
| `src/app/(main)/home/_components/TodoList.tsx` | 203 | C | 00:14.55 |
| `src/app/(main)/home/_components/TodoList.tsx` | 515 | V | 00:14.55 |
| `src/app/(main)/home/_components/TodoList.tsx` | 527 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 541 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 551 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 552 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 553 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 554 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 555 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 556 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 557 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 561 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 581 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 582 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 600 | C | 00:22.27 |
| `src/app/(main)/home/_components/TodoList.tsx` | 609 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 610 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 611 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 612 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 616 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 654 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 655 | V | 00:22.29 |
| `src/app/(main)/home/_components/TodoList.tsx` | 668 | V | 00:22.29 |
| `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 84 | V | 00:22.29 |
| `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 85 | V | 00:22.29 |
| `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 86 | V | 00:22.29 |
| `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 89 | V | 00:22.29 |
| `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 109 | V | 00:22.29 |
| `src/app/(main)/home/page.tsx` | 15 | V | 00:14.55 |
| `src/app/(main)/home/page.tsx` | 16 | V | 00:14.55 |
| `src/app/(main)/home/page.tsx` | 17 | V | 00:14.55 |
| `src/app/(main)/home/page.tsx` | 18 | V | 00:14.55 |
| `src/app/(main)/home/page.tsx` | 21 | V | 00:14.55 |
| `src/app/(main)/home/page.tsx` | 22 | V | 00:14.55 |
| `src/app/(main)/layout.tsx` | 20 | V | 00:14.55 |
| `src/app/layout.tsx` | 50 | V | 00:00.03 |
| `src/app/layout.tsx` | 59 | V | 00:00.03 |
| `src/app/login/[[...login]]/page.tsx` | 77 | V | 00:14.35 |
| `src/app/login/[[...login]]/page.tsx` | 78 | V | 00:14.35 |
| `src/app/login/[[...login]]/page.tsx` | 84 | V | 00:00.03 |
| `src/components/AppSidebar.tsx` | 59 | C | 00:14.53 |
| `src/components/AppSidebar.tsx` | 85 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 86 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 87 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 88 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 91 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 95 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 96 | V | 00:14.95 |
| `src/components/AppSidebar.tsx` | 97 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 105 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 106 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 112 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 176 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 177 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 178 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 179 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 180 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 188 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 189 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 190 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 191 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 193 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 194 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 195 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 199 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 204 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 205 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 206 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 214 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 216 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 218 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 220 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 221 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 222 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 226 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 227 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 228 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 229 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 232 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 233 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 234 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 235 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 243 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 244 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 245 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 251 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 253 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 259 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 261 | V | 00:14.55 |
| `src/components/AppSidebar.tsx` | 267 | V | 00:14.55 |
| `src/components/grid.tsx` | 6 | C | 00:22.27 |
| `src/components/import/PasteImport.tsx` | 93 | C | 00:22.28 |
| `src/components/import/PasteImport.tsx` | 109 | C | 00:55.76 |
| `src/components/import/PasteImport.tsx` | 134 | C | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 115 | C | 00:22.28 |
| `src/components/import/PasteImportDialog.tsx` | 167 | C | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 240 | C | 00:22.28 |
| `src/components/import/PasteImportDialog.tsx` | 251 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 253 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 259 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 265 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 276 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 277 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 278 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 284 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 289 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 301 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 305 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 310 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 337 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 338 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 346 | V | 00:55.76 |
| `src/components/import/PasteImportDialog.tsx` | 386 | V | 00:55.76 |
| `src/components/ui/button.tsx` | 38 | C | 00:14.53 |
| `src/components/ui/card.tsx` | 64 | C | 00:22.30 |
| `src/components/ui/dialog.tsx` | 59 | V | 00:55.76 |
| `src/components/ui/dialog.tsx` | 60 | V | 00:55.76 |
| `src/components/ui/dialog.tsx` | 70 | V | 00:55.76 |
| `src/components/ui/dialog.tsx` | 74 | V | 00:55.76 |
| `src/components/ui/dialog.tsx` | 75 | V | 00:55.76 |
| `src/components/ui/dialog.tsx` | 83 | C | 00:55.77 |
| `src/components/ui/form.tsx` | 85 | V | 00:22.29 |
| `src/components/ui/form.tsx` | 111 | C | 00:26.46 |
| `src/components/ui/input.tsx` | 5 | C | 00:39.18 |
| `src/components/ui/input.tsx` | 17 | C | 00:39.18 |
| `src/components/ui/popover.tsx` | 20 | C | 00:14.57 |
| `src/components/ui/popover.tsx` | 28 | V | 00:32.50 |
| `src/components/ui/select.tsx` | 47 | V | 00:22.29 |
| `src/components/ui/sidebar.tsx` | 58 | C | 00:14.53 |
| `src/components/ui/sidebar.tsx` | 128 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 214 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 225 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 240 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 272 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 273 | V | 00:14.55 |
| `src/components/ui/sidebar.tsx` | 303 | C | 00:14.66 |
| `src/components/ui/sidebar.tsx` | 381 | C | 00:36.16 |
| `src/components/ui/sidebar.tsx` | 413 | C | 00:32.51 |
| `src/components/ui/sidebar.tsx` | 494 | C | 00:14.53 |
| `src/hooks/useCategoryMutations.ts` | 36 | C | 00:39.74 |
| `src/hooks/useCategoryMutations.ts` | 50 | C | 00:41.86 |
| `src/hooks/useCategoryMutations.ts` | 82 | C | 00:43.97 |
| `src/hooks/useHeatmapData.ts` | 46 | C | 00:14.55 |
| `src/hooks/useHeatmapData.ts` | 52 | C | 00:14.55 |
| `src/hooks/useLocalDayKey.ts` | 70 | C | 00:22.29 |
| `src/hooks/useLocalDayKey.ts` | 90 | C | 00:22.29 |
| `src/hooks/useSoundFeedback.ts` | 29 | C | 00:22.27 |
| `src/lib/getLocalTodayIsoDate.ts` | 18 | C | 00:22.29 |
| `src/lib/getLocalTodayIsoDate.ts` | 19 | C | 00:22.29 |
| `src/lib/query/createQueryClient.ts` | 17 | C | 00:35.53 |
| `src/lib/query/createQueryClient.ts` | 19 | C | 00:43.67 |
| `src/lib/utils.ts` | 5 | C | 00:14.53 |
| `src/providers/QueryClientProvider.tsx` | 34 | C | 00:14.07 |
| `src/providers/QueryClientProvider.tsx` | 35 | C | 00:14.07 |

## 2. Mode B 実行タイムライン（バケット × ファイル × 行）— デバッガー表示相当

録画を決定論的に再実行したときに、タイムラインのどの時点でどのファイルの何行が実行されたか。★ は録画の直接証拠(C/V/S)を持つ行を含むことを示す。

| 時刻 (REC) | 区間 | ファイル | 実行行 | 直接証拠 |
|---|---|---|---|---|
| ≈00:00.00–00:00.68 | 実行中 | `src/app/error.tsx` | 1, 3, 13-15, 17-26, 35, 49-50, 55, 61, 91, 93 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/app/global-error.tsx` | 1, 3, 22, 24, 33-48, 50-58, 60-64, 66-71, 73-78, 80-90, 92-98, 100, 111-112, 119, 122, 135-136, 140, 161, 171, 173 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/app/login/[[...login]]/page.tsx` | 1, 3, 5-9, 11-12, 14, 26, 43, 45, 60-63, 66-67, 70-72, 75, 77-79, 84-85, 101-103, 105, 107 | ★ |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/auth/ElectronLoginForm.tsx` | 1, 3-6, 9-13, 15, 61, 72, 126, 397, 399, 402-408, 410-413, 415-417, 425-430 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 1, 14-18 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/electron/ElectronStartupSync.tsx` | 1, 3, 29, 31-36, 38, 40, 56, 72, 99-101, 111-114, 116-117, 122-125, 127-128, 130 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/ui/button.tsx` | 1-3, 5, 7-36, 38, 55 | ★ |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/ui/card.tsx` | 1, 3, 5, 14, 18, 27, 31, 37, 41, 47, 51, 60, 64, 70, 74, 80 | ★ |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/ui/input.tsx` | 1, 3, 5, 17 | ★ |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/ui/label.tsx` | 1, 3-4, 6, 8, 20 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/components/ui/sonner.tsx` | 1, 3-4, 6, 8, 10-11, 16-17, 20-22, 24-28, 34-36 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/hooks/use-cycle-effect.ts` | 1, 30-37 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/hooks/use-initial-effect.ts` | 1, 18-22 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/hooks/useReducerState.ts` | 1, 15, 21 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/braindump.ts` | 1, 15, 17-18, 21, 24, 30, 70, 81-86, 100, 103-107, 113-117, 120, 123, 126, 129, 132, 139, 154-159, 162, 176-177, 190, 193, 201, 204, 214, 238, 245, 248, 251 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/electronSettings.ts` | 1, 8, 10, 13-18 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/query.ts` | 1-3 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/settings.ts` | 1, 14-15, 17, 22-25, 27-32, 34, 37-40 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/sound.ts` | 1, 13, 15, 18-19, 31, 55-57, 63-92, 95-96, 100, 103, 116-132 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/constants/theme.ts` | 1, 8-9 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/logger.ts` | 1, 16-17, 19, 24-27, 29, 41-55, 62-64, 80, 95, 97, 107-108, 114-115, 121-122, 128-129, 135-136, 142-143, 145 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/orpc/client-query.ts` | 1, 3, 5, 8-9, 21 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/orpc/create-client.ts` | 1-2, 7, 16-18, 23-24, 65-67, 75-77 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/orpc/electron-auth-provider.tsx` | 1, 3-4, 7, 9-10, 23-24, 27-32, 34-39, 43, 236, 244, 246-248, 250, 253-254, 256-258, 266, 274, 276, 279-280, 282-287, 316, 318-319, 354, 356, 367, 379 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/orpc/serializer.ts` | 1, 3-13 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/query/createQueryClient.ts` | 1, 6, 10, 13-16, 20-25, 29-31, 34-38 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/foldLegacyCompletionSoundIntoMoments.ts` | 1, 8-9, 12, 78 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/hooks.ts` | 1, 24-25, 39, 52 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/migratePersistedState.ts` | 1, 3-4, 8, 24, 29-31, 110 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/providers.tsx` | 1, 3, 31-33, 35, 37-41, 68, 70, 72-74, 76 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/slices/electronSettingsSlice.ts` | 1, 18-19, 21, 43-45, 51-55, 61-62, 64, 66, 72-73, 75, 77, 83-84, 86, 88, 93-94, 96-98, 101-106, 115-116, 124-125, 133-134, 142, 144, 146 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/slices/settingsSlice.ts` | 1, 23-24, 26, 37-39, 52, 58-62, 67-68, 70, 72, 76-77, 79, 81, 88-89, 98, 100, 111-112, 118, 120, 124-125, 127, 129, 134-135, 142, 144, 152-153, 163, 165, 171-172, 180, 182, 190-191, 198, 200, 205-206, 208, 210, 217-218, 226, 228, 235-236, 244, 246, 251-252, 254, 256, 259-260, 262-264, 267-282, 292-293, 300-301, 318, 333, 340-341, 348-349, 356, 359, 366-367, 374-375, 382, 384, 391-392, 399, 401, 409, 425, 427 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/redux/store.ts` | 1, 15-16, 20, 22, 24, 28-29, 31, 34-38, 45, 71-79, 81-82, 96-107 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/schemas/settings.ts` | 1, 11-12, 14, 29, 36, 42-53, 62-83, 85-89, 92, 95-102, 105-107, 110-114, 117, 120-121, 124-128, 131, 134-135 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/settings-sync-channel.ts` | 3-4, 19, 26-27, 34-55, 57, 60-62, 64, 72-73, 83, 103, 107-108, 110, 112, 114-117, 140, 142, 160-162 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/themes/registry.ts` | 1, 11, 13, 94-112, 114-119, 121-152, 154-189, 191-222, 224-255, 257-290, 293, 306-308, 311-312, 328-333, 350, 362-369, 377-378 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/lib/utils.ts` | 1, 3, 7, 15, 26, 48 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/providers/QueryClientProvider.tsx` | 1, 3-7, 10-12, 14-19, 21-22, 24, 34-35, 39-41, 43-46, 48-49, 51, 77, 81-84, 87, 101-102, 104, 109, 111, 114, 116-117, 120-127, 129 | ★ |
| ≈00:00.00–00:00.68 | 実行中 | `src/providers/ThemeAllowlistGuard.tsx` | 1, 3, 5-6, 8-9, 26-27, 29, 33-36, 38 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/providers/ThemeProvider.tsx` | 1, 3, 5, 7-11, 14-15, 22, 33-38, 50, 53-54, 57-66, 69, 72-74, 76 |  |
| ≈00:00.00–00:00.68 | 実行中 | `src/providers/ThemeTransition.tsx` | 1, 3-4, 6-7, 19, 23-25, 29-30, 32, 34-37, 40-43, 49-50, 52 |  |
| ≈00:00.00–00:00.68 | 実行中 | `utils/electron-client.ts` | 1, 15, 17, 27-30, 32, 42, 47, 63, 67, 74, 80 |  |
| ≈00:09.39–00:09.89 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:09.39–00:09.89 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:09.39–00:09.89 | 実行中 | `src/lib/orpc/electron-auth-provider.tsx` | 23-24, 27-32, 34-39, 43, 236, 244, 246-248, 250, 253-254, 256-258, 266, 274, 276, 279-280, 282, 316, 318-319 |  |
| ≈00:09.39–00:09.89 | 実行中 | `src/providers/QueryClientProvider.tsx` | 35, 39-41, 43, 49, 51 | ★ |
| ≈00:09.39–00:09.89 | 実行中 | `utils/electron-client.ts` | 27-30, 32 |  |
| ≈00:13.60–00:16.11 | 実行中 | `electron/types/ipc.ts` | 1, 8, 102-105 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/AddTodoForm.tsx` | 1-5, 7-23, 25-29, 45, 100, 103, 170 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 1, 3-10, 12-44, 57, 61-66, 69-71, 74-78, 81-85, 88-89, 92-94, 100, 104-105, 110, 123-124, 126-128, 130-132, 134-136, 138, 142-143, 146-166, 169-176, 178-183, 185-197, 199-200, 215-216, 219, 229-232, 234 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CategoryManageDialog.tsx` | 1, 3-10, 12-39, 53, 56-58, 61-63, 66-68, 71-75, 81, 87-88, 93, 96-97, 102, 111-112, 117, 120-121, 126, 132-133, 135-137, 139, 141-142, 144, 147-148, 150, 153-154, 156-158, 161-166, 169-170, 172-174, 176, 264-267, 270-278, 290-305, 307 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CompletedDropZone.tsx` | 1, 3-4, 11, 30, 35, 62 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 1, 3-5, 7-14, 33, 57, 106 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CompletedJournalRow.tsx` | 1-2, 4-7, 38, 94 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CompletedTodos.tsx` | 1-3, 5, 7-27, 30-35, 54-57, 66, 100, 122, 129, 144, 155, 192, 197, 323 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 1, 3-5, 8-27, 47-50, 52-59, 68, 81, 313, 330 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/ContributionGraph.tsx` | 1, 3-5, 7, 9-25, 27-37, 39, 41-42, 44-45, 47-48, 50-51, 53-54, 56-57, 59, 64-65, 67, 76-83, 85-86, 88-89, 99, 103-115, 117, 125, 128, 130, 136, 145, 147, 149-150, 169, 178, 188, 234, 382, 394, 396, 406-407, 413, 446, 492, 494, 502, 514, 516, 524, 530, 532, 539, 544, 546, 558, 561, 563, 579, 587 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/DayDetailDialog.tsx` | 1, 3-6, 8-29, 52, 62, 104, 106, 120, 129, 131, 147, 163, 177, 249, 372 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/LogoutButton.tsx` | 1, 3-4, 6-7, 9-10, 29 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/retroactivePopulateFade.ts` | 10, 19-20, 26, 60 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/SortableTodoItem.tsx` | 1, 3-4, 6, 8, 43, 52, 78 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/SundayDigestCard.tsx` | 1, 3-4, 6-8, 10-14, 16, 20-21, 23, 25-26, 28, 32-33, 46, 59, 74, 76, 87, 96, 98, 106, 114, 116, 121, 129, 131, 145, 160, 182, 187, 287, 294 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/TodoItem.tsx` | 1-9, 11-22, 59, 80, 248 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/TodoList.tsx` | 1-12, 14-49, 52-62, 64-65, 67-69, 71, 86-93, 108, 117-118, 120-121, 124, 127, 130, 138, 144-145, 148, 151-154, 159, 161-164, 169, 172, 180-182, 186-192, 196-197, 203-204, 212-214, 216, 228, 237-238, 248, 252-253, 263, 267-268, 279, 283-284, 293, 298-299, 305-312, 314-315, 325-328, 331-333, 336, 340-343, 360-363, 365, 367-369, 381-382, 401, 403-406, 410-411, 416-417, 434, 484, 487-488, 490, 498, 506-508, 512, 514-516, 521, 541, 561, 579, 585-586, 595, 599, 604-606, 650-651, 663, 672, 689, 699-702, 704 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 1, 3, 5, 7-13, 28, 40, 59, 76, 132, 139 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/_components/YearInReviewModal.tsx` | 1, 3-5, 7-16, 18-26, 28, 38-39, 50, 60, 75, 77, 85, 93, 114, 157, 263, 287, 289, 295-296, 319 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/(main)/home/page.tsx` | 1, 3, 5, 9, 11-12, 14-24, 26, 28 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/app/login/[[...login]]/page.tsx` | 61-63, 66-67, 70-72, 75, 77-79, 84, 102-103 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/AppSidebar.tsx` | 1, 3-19, 21-48, 50, 52, 59-64, 66-71, 73-81, 84-132, 134-135, 137-154, 156-167, 169-174, 176-185, 188-212, 214, 216, 218, 220-222, 226-241, 243-276, 278 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/auth/ElectronLoginForm.tsx` | 403-408, 410-413, 425-430 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/braindump/braindumpUtils.ts` | 1, 21, 31, 34, 101, 121, 150, 176, 200, 231, 262, 264, 269-270, 324, 341 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14-18 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/electron/ElectronStartupSync.tsx` | 99-101, 111-114, 116-117, 122-125, 127-128, 130 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/grid.tsx` | 3, 6, 10 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/import/ImportUndoBanner.tsx` | 1, 3-5, 7, 9-11, 42, 70, 93, 139, 185 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/import/paste-import-types.ts` | 1, 10, 12-13, 100 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/import/PasteImport.tsx` | 1, 3-4, 6-7, 9-11, 14-18, 20-21, 23, 27-28, 93, 127, 236 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/import/PasteImportDialog.tsx` | 1, 3-4, 6, 8-26, 29-33, 35, 39-42, 50-62, 115, 138, 151, 177, 295, 357, 359, 366, 368, 377-378, 401, 403, 411-412, 473, 475, 484-485, 553, 589 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ThemePreviewSwatch.tsx` | 2, 23, 61, 66 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ThemeSelector.tsx` | 1, 3, 6-10, 12-14, 17-24, 36, 46, 95, 153 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ThemeSelectorMenuItem.tsx` | 1, 3, 5-23, 34, 43, 117 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/alert-dialog.tsx` | 1, 3-4, 6-7, 9, 11-12, 15, 19, 23, 25, 27, 31, 43, 47, 50, 52-62, 66, 75, 79, 91, 95, 104, 108, 117, 121, 129, 133, 141 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/avatar.tsx` | 1, 3-4, 6, 8, 11, 13-20, 24, 27, 29-33, 37, 40, 42-49 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/badge.tsx` | 1-3, 5, 7-26, 28, 42 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/calendar.tsx` | 1, 3-8, 10, 12-14, 16, 175, 177, 186, 211, 215 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/card.tsx` | 74 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/checkbox.tsx` | 1, 3-5, 7, 9, 28 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/collapsible.tsx` | 1, 3-4, 6, 9, 12, 19, 23, 30 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/dialog.tsx` | 1, 3-5, 7, 9, 11-12, 18, 21, 23-24, 27, 30, 33, 45, 49, 52, 56, 58-79, 83, 89, 93, 102, 106, 115, 119, 128 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/dropdown-menu.tsx` | 1, 3-5, 7, 9, 11-12, 19, 23, 25, 27-30, 34, 36, 38, 40-50, 54, 58, 62, 81, 85, 107, 111, 118, 122, 142, 146, 162, 166, 175, 179, 191, 195, 198, 201, 221, 225, 237 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/form.tsx` | 1, 4-14, 16-17, 19, 28-30, 32, 41, 45-46, 48, 52, 69, 75-77, 79, 90, 94, 98, 107, 111-112, 125, 129-130, 138, 142-143, 158 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/input.tsx` | 5, 7-17 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/label.tsx` | 8 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/popover.tsx` | 1, 3-4, 6, 8, 10-11, 14, 16-17, 20, 22-23, 25, 27-38, 42, 45 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/radio-group.tsx` | 1, 3-5, 7, 9, 18, 22, 41 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/select.tsx` | 1, 3-5, 7, 9, 12, 15, 18, 21, 24, 27, 49, 53, 84, 88, 97, 101, 121, 125, 134, 138, 152, 156, 170 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/separator.tsx` | 1, 3-4, 6, 8, 10-11, 13, 15-24 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/sheet.tsx` | 1, 3-5, 7, 9-10, 13, 16, 19, 22, 25, 28, 31, 43, 47, 80, 84, 90, 94, 100, 104, 113, 117, 126 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/sidebar.tsx` | 1, 3, 5-7, 9-28, 30-35, 47, 49-53, 55, 58-59, 70-72, 76-78, 87-88, 91-93, 96-97, 104-105, 107-109, 113, 115, 123, 126-129, 131-135, 137-146, 150-153, 161-162, 164, 175, 179, 200, 205-212, 214-220, 222-229, 231, 233, 235-248, 252, 256-257, 260-266, 268-274, 278-279, 299, 303, 305-313, 317, 327, 331, 333-338, 342, 344-349, 353, 356, 358-363, 367, 369-377, 381, 383-388, 392, 394, 396-397, 400-409, 413, 415, 417-418, 421-425, 427-432, 436, 439, 441-446, 450, 452-457, 461, 463-468, 472-492, 494-498, 506-508, 510-518, 521-522, 532, 537, 539-540, 544, 572, 576, 594, 598, 607, 632, 636, 647, 651, 661, 665, 693 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/skeleton.tsx` | 1, 3, 5, 11 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/sonner.tsx` | 10-11, 16-17, 20-22, 24-28, 34-36 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/textarea.tsx` | 1, 3, 5, 14 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/toggle-group.tsx` | 1, 3-5, 7-8, 10-12, 14-15, 36, 38-39, 67 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/toggle.tsx` | 1, 3-5, 7, 9-29, 31, 43 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/components/ui/tooltip.tsx` | 1, 3-4, 6, 8-9, 11, 13-17, 21, 27, 31, 34, 37, 57 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/use-initial-effect.ts` | 18-22 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/use-mobile.ts` | 1, 3, 5, 9-14, 16, 19-22, 24, 27, 30, 40-41 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/use-mounted.ts` | 1, 3, 7-8, 10, 13-14, 16, 19-20, 39-40, 44 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/use-update-effect.ts` | 1-7, 37-42, 44-48, 50-55, 57 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useCategoryMutations.ts` | 1, 3, 5-6, 36-37, 40, 43, 48-49, 76, 81, 84, 86, 91-92, 110, 115, 118, 120, 125-126, 142, 147, 152, 154, 156, 160 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 1, 3, 18-20 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useCompletionFeedback.ts` | 1, 3, 5, 12-14, 43-45 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useElectronNotifications.ts` | 1, 3, 5-6, 8, 31-39, 59, 64, 80, 82-84, 86, 88-92, 94, 103, 105, 121, 123, 143, 145, 155, 157, 167, 169-173, 206, 208-219 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useHeatmapData.ts` | 1, 3-4, 6-7, 46-47, 52-56, 69-70, 72, 75-79, 81, 83, 86-88, 90 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useKeyboardNav.ts` | 1, 36, 46, 82 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useLocalDayKey.ts` | 1, 3, 5-6, 8, 14, 62, 64, 69, 72, 74, 79, 82, 90-91, 95 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useReducerState.ts` | 15 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useSelectedCategory.ts` | 1, 3, 5, 7, 9, 12-13, 15, 17-18, 22, 24, 27-31, 33-34, 36-37, 39, 41-42, 44, 48-50, 52-53, 57-58, 60-64, 82, 86-90, 92, 102-103, 105, 108, 120-121, 126-127, 131, 133-134, 137-139 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useSoundFeedback.ts` | 1-2, 4-9, 29-34, 40-42, 44, 51 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useStreakNotifications.ts` | 1, 3-4, 7-9, 11-12, 15, 23-24, 26, 35, 38, 50, 57-79, 81, 93, 107, 109, 117, 125, 166, 172-174, 180-181, 191-194, 196-197, 216-217, 238-249 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useThemeAxis.ts` | 1, 3, 5-14, 21, 65, 67, 88, 120 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useTodoMutations.ts` | 1, 4-9, 11-15, 48, 61, 75, 100, 102, 104, 114-122, 127-131, 135-136, 168, 174, 181, 183, 188-190, 396-397, 424-425, 450-451, 456-457, 497, 509, 535, 537, 542-543, 582, 594, 609, 611, 616-618, 629-630, 647, 651-652, 657-659, 674-675, 702-703, 708-709, 721, 724, 727, 740, 746, 750, 752, 762-768, 770, 778 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/hooks/useTodoPasteImport.ts` | 1, 3-4, 7-9, 53-56, 59-60, 65, 70-71, 74, 76-78, 80, 83-84, 86-88, 90, 92, 100 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/aggregate-last-seven-days.ts` | 3, 5, 8-9, 11, 15-16, 18, 21-22, 81, 96, 130, 198 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/aggregate-year-in-review.ts` | 3, 13, 54, 58-59, 142, 175, 207 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/audio/soundEngine.ts` | 1, 19, 21, 28, 30, 32-33, 35, 40-41, 43-44, 46, 49-50, 52-53, 55, 59-60, 62, 64, 69, 89, 91, 95, 105, 107, 112, 118, 120, 128, 160, 162, 171, 188, 190, 197, 226, 243, 283, 300, 317 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/buildDateSyncUrl.ts` | 1, 22, 38 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/calc-streak.ts` | 3, 13, 55, 66, 73, 169, 171, 184, 190 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/calcMonthlyMaxDates.ts` | 88 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/category-colors.ts` | 1, 8, 12-19, 29-30 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/category-sync-channel.ts` | 1-2, 6, 9-12, 14, 16, 19-21, 23, 25-26, 28, 32-33, 39, 47, 58, 68-70, 72, 74, 78, 80, 82-86 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/clearedAffirmation.ts` | 1, 15, 21 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/completed.ts` | 1-2, 4, 6, 8, 10, 12, 14 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/completionFeedback.ts` | 1, 9-10, 18, 20, 22, 24, 27 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/date.ts` | 1-2, 5 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/electronSettings.ts` | 18 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/heatmap.ts` | 1-2 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/import.ts` | 1, 11, 13, 20-21, 30, 39 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/settings.ts` | 40 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/constants/theme.ts` | 8-9 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/dnd-kit-sensors.ts` | 1, 8-11, 13, 21, 24, 26, 35, 38, 46-51, 53, 59, 71, 79-84 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/export-day-as-image.ts` | 1, 5, 8, 23-31, 57, 60-61, 78, 208, 210, 221, 229, 292 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/formatClockTime.ts` | 1, 13-14, 19 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/getLocalTodayIsoDate.ts` | 1, 21 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/heatmap-intensity.ts` | 1, 13, 15, 19, 22, 25, 32-38, 62 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/interceptBulkPaste.ts` | 3, 39 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/isMultiLinePaste.ts` | 1-2, 26 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/logger.ts` | 145 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/orpc/client-query.ts` | 21 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/orpc/electron-auth-provider.tsx` | 23-24, 27-32, 34-39, 43, 236, 244, 246-248, 250, 253-254, 256-258, 266, 274, 276, 279-280, 282-287, 316, 318-319 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/orpc/serializer.ts` | 8, 13 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/parsePasteToTasks.ts` | 1, 17, 19, 42, 47-48, 94, 126 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/paste-import-channel.ts` | 1, 11, 13-14, 20, 27-28, 32, 34, 37-38, 41, 43, 47-48, 53, 65, 73, 84, 99 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/query/createQueryClient.ts` | 13-25, 29-31, 34-38 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/redux/migratePersistedState.ts` | 110 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/redux/providers.tsx` | 68, 70, 72-74 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/redux/slices/electronSettingsSlice.ts` | 115-116, 124-125 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/redux/slices/settingsSlice.ts` | 300-301, 318-320, 322-328, 333, 340-341, 348-349 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/redux/store.ts` | 107 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/shiftIsoDate.ts` | 1, 23, 28 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/themes/preview.ts` | 1, 26, 33-44, 46-48, 50, 58-86, 127 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/themes/registry.ts` | 13, 306-308, 328-333, 378 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/todo-sync-channel.ts` | 1-2, 6, 13-16, 18, 20, 28-30, 32, 34-35, 37, 45-46, 52, 62, 71, 82-84, 86, 88, 92, 94, 96-100 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/toLocalDayKey.ts` | 1, 7-8, 10, 17, 29, 75 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils.ts` | 5-7, 26-27, 29-30, 32, 34-43, 48 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils/getMillisecondsUntilNextLocalDay.ts` | 1, 3, 15 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils/getNotificationSettings.ts` | 1, 14, 22 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils/getUnfilteredCompletedJournalInput.ts` | 1, 10-11, 13-17 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils/resolveCompletedJournalDateRange.ts` | 1, 12, 14, 21, 95 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/lib/utils/updateNotificationSettings.ts` | 1, 19, 28 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/providers/QueryClientProvider.tsx` | 15-19, 35, 39-41, 43-46, 48-49, 51, 77, 81-84, 87, 101-102, 104, 109, 111, 114, 116-117, 120-127 | ★ |
| ≈00:13.60–00:16.11 | 実行中 | `src/providers/ThemeAllowlistGuard.tsx` | 26-27, 29, 33-36, 38 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/providers/ThemeProvider.tsx` | 50, 53-54, 57-66, 69, 72-74 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/providers/ThemeTransition.tsx` | 19, 23-25, 29-30, 32, 34-37, 40-43, 45-50, 52 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/server/schemas/category.ts` | 1, 8-9, 12-19, 21, 29-41, 50-53, 59-62, 67-71, 78-80 |  |
| ≈00:13.60–00:16.11 | 実行中 | `src/server/schemas/completed.ts` | 1, 3, 5, 16-17, 24-27, 35-38, 46-48, 64-68, 79-85, 97-100, 107-109, 119-121, 129-136, 150-155, 162-166, 173-180, 188-194, 201-202, 204-205, 220-232, 247-252, 262-270, 283, 296-301 |  |
| ≈00:13.60–00:16.11 | 実行中 | `utils/electron-client.ts` | 27-30, 32, 80 |  |
| ≈00:18.62–00:21.13 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:24.29–00:24.79 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:24.29–00:24.79 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| 00:24.90–00:25.01 | 操作#781 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| 00:25.01–00:25.21 | 操作#783 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| 00:25.21–00:25.35 | 操作#794 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:25.35–00:25.85 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| 00:25.86–00:26.02 | 操作#803 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| 00:26.02–00:26.43 | 操作#807 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:26.43–00:26.93 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:27.23–00:27.73 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/AddTodoForm.tsx` | 45, 49-53, 55-61, 63, 66-67, 69, 73-84, 86, 101, 103, 106-118, 120-132, 135-142, 144-146, 148-168, 170 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/Category.tsx` | 57 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 33-37, 40-44, 47-49, 51-53, 57-59, 67, 72-73, 75, 78-79, 81-83, 85, 89-97, 99-104, 106 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/CompletedJournalRow.tsx` | 38 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/CompletedTodos.tsx` | 66, 69-75, 79, 81-85, 88, 92-95, 100-102, 106, 114-124, 127-128, 130, 133, 145, 148, 151-152, 155-156, 161-163, 165-167, 169-170, 178-180, 182-185, 188-190, 192-194, 198-199, 222-224, 261-262, 265-274, 276-293, 297, 299, 303, 305, 309, 311-312, 314-316, 318-321, 323 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 68, 77-81, 83-84, 87-98, 100, 102, 105-114, 121-128, 130-135, 137-142, 144-145, 147-149, 152-170, 172-181, 183-191, 201-205, 207-210, 212-225, 227-228, 230-235, 237, 239-242, 245, 247-254, 256-261, 272-274, 276-280, 282-284, 294-306, 313-316, 318, 329-330 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/ContributionGraph.tsx` | 188-192, 199-200, 202, 208-209, 223-225, 234-243, 245-246, 248, 250, 256, 262, 265-270, 272, 325, 327, 329-331, 333, 335-337, 339-342, 347, 354, 382, 390-392, 394, 407, 411, 413-414, 443-444, 446, 467-472, 474-477, 483-485, 487-492, 503-506, 508, 510, 512-514, 525-527, 529-530, 540-544 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/DayDetailDialog.tsx` | 177 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/SortableTodoItem.tsx` | 43 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/SundayDigestCard.tsx` | 60-69, 71-74, 107-111, 113-114, 146-160, 182, 186-187, 191-194, 199-202, 211-212, 214, 216-217, 219-221, 229-230, 239, 250, 263, 265, 287, 290-292, 294 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/TodoList.tsx` | 117-118, 120-121, 124, 127, 130, 138, 144-145, 148, 151-152, 154, 159, 161, 163-164, 169, 172, 180, 191, 197, 203-204, 212-214, 216, 228, 237-238, 248, 252-253, 263, 267-268, 279, 283-284, 293, 298-299, 305-306, 308-309, 311-312, 314-315, 325-328, 331, 333, 336, 340, 342-343, 360-363, 365, 367, 369, 381, 406, 410, 417, 434, 487-488, 490, 508, 512, 516, 521, 527, 529, 531-533, 535-538, 541-548, 551-561, 565, 579-586, 591-606, 608-612, 614, 616, 618-620, 650-651, 654-658, 660-663, 667-673, 680-689, 692-696, 698-702 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 41-48, 50-52, 57-59, 76, 79-80, 83-86, 88-89, 96, 98, 100-107, 109-111, 113, 132, 135-137 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/app/(main)/home/_components/YearInReviewModal.tsx` | 114, 118-122, 128, 130, 139, 157-160, 163-164, 166, 184-185, 187-189, 191-193, 195, 271, 283-285, 287 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/braindump/braindumpUtils.ts` | 21, 79-81, 83-84, 90, 101, 337-339, 341 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/grid.tsx` | 6-9 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/import/ImportUndoBanner.tsx` | 42, 46, 51-53, 61-62, 64-72, 74-77, 79, 96-97, 99, 142-143, 148, 155, 158, 179, 181-183, 185 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/import/paste-import-types.ts` | 77-82, 84-86, 88-90, 92-100 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/import/PasteImport.tsx` | 93-104, 106-109, 112, 114-116, 118-129, 131-132, 134, 141, 143, 146-147, 178, 180, 220, 222-234, 236 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/import/PasteImportDialog.tsx` | 54, 59, 115, 125-127, 130-133, 137-139, 142-144, 146, 150-152, 154, 156-157, 160, 164-165, 167, 171-172, 174, 178-179, 181-183, 185, 191-192, 194, 200-201, 205-207, 209-211, 213, 224-225, 227-229, 233-235, 237-240, 243-246, 248-251, 253-255, 259, 261-262, 265-273, 276-292, 296-299, 301-302, 305-307, 310-322, 326, 328, 331, 335, 337-343, 345-353, 358-364, 366, 553 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/alert-dialog.tsx` | 9, 11-12, 23, 25, 27, 47, 50, 52-62, 133 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/badge.tsx` | 28, 31, 34-35, 38-42 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/calendar.tsx` | 215 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/card.tsx` | 5, 7-14, 18, 20-27, 31, 33-37, 41, 43-47, 64, 66-70, 74 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/collapsible.tsx` | 6, 8-9, 12, 14, 16-19, 23, 25, 27-30 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/dialog.tsx` | 9, 11-12, 15, 17-18, 21, 23-24, 49, 52, 56, 58-79 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/form.tsx` | 32, 35-36, 39-41, 48-53, 55-56, 59, 61, 63-68, 79-81, 84-90, 111-112, 115-117, 119-121, 123-125, 142-144, 146-147, 156, 158 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/input.tsx` | 5, 7-17 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/popover.tsx` | 8, 10-11, 14, 16-17, 20, 22-23, 25, 27-38 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/radio-group.tsx` | 22 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/select.tsx` | 9, 11-12, 21, 23-24, 27, 29, 34, 36-49, 53, 56, 58, 60-84, 101, 105, 107-121, 138, 141, 143-152, 156, 159, 161-170 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/textarea.tsx` | 5 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/toggle-group.tsx` | 15-19, 22-34, 39-43, 46, 49-65, 67 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/components/ui/toggle.tsx` | 31 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/use-mounted.ts` | 8, 14, 39-44 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/use-update-effect.ts` | 37-42, 44-48, 50-55, 57 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useCategoryMutations.ts` | 125 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useElectronNotifications.ts` | 82-84, 86, 88-92, 94, 103, 105, 121, 123, 143, 145, 155, 157, 167, 169, 206, 208-219 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useHeatmapData.ts` | 46-47, 52-56, 69-70, 72, 75-79, 81, 83, 86-88, 90 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useLocalDayKey.ts` | 15-16, 18, 23-26, 29-30, 32, 37, 41, 43, 48, 51, 53-55, 57-62, 70-72, 90-95 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 49-50, 52-53, 57-58, 60-64, 82, 86-90, 92, 103, 105 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useSoundFeedback.ts` | 29-34, 40, 42, 44, 51 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useStreakNotifications.ts` | 166, 172-173, 180-181, 191, 194, 196-197, 216-217, 239-249 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useTodoMutations.ts` | 100, 102, 104, 114, 121-122, 127-128, 131, 135-136, 183, 188-189, 424, 450-451, 456-457, 537, 542-543, 611, 616-617, 629, 651, 674, 702-703, 708-709, 752, 762, 767-768, 770, 778 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/hooks/useTodoPasteImport.ts` | 53-56, 59-60, 65, 71, 74, 78, 80, 84, 86, 88, 90, 100 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/aggregate-last-seven-days.ts` | 97-100, 105-106, 108-111, 127, 129-130, 160-162, 164, 166-167, 169-170, 175-176, 178-186, 190, 192-198 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/aggregate-year-in-review.ts` | 197-198, 207 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/audio/soundEngine.ts` | 317 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/buildDateSyncUrl.ts` | 22-26, 28-31, 33-38 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/calc-streak.ts` | 190 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/calcMonthlyMaxDates.ts` | 55-56, 58-62, 64, 85, 87-88 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/completed.ts` | 1, 14 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/date.ts` | 1, 5 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/heatmap.ts` | 1 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/import.ts` | 20 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/query.ts` | 3 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/constants/settings.ts` | 40 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/dnd-kit-sensors.ts` | 84 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/getLocalTodayIsoDate.ts` | 18-21 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/interceptBulkPaste.ts` | 39 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/orpc/serializer.ts` | 8 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/parsePasteToTasks.ts` | 72-76, 78-81, 85, 87-92, 94, 116-126 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/paste-import-channel.ts` | 28-30, 32, 38-41, 84-85, 87-88, 90, 92, 94-99 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/shiftIsoDate.ts` | 23-28 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/toLocalDayKey.ts` | 18-29, 56-70, 74-75 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/utils.ts` | 5-7, 48 | ★ |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/utils/getMillisecondsUntilNextLocalDay.ts` | 12-15 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/utils/getUnfilteredCompletedJournalInput.ts` | 10-11, 13-17 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/utils/resolveCompletedJournalDateRange.ts` | 40-43, 45-47, 55-56, 62-63, 69-70, 76-77, 93-95 |  |
| 00:28.23–00:28.35 | 操作#812 | `src/lib/utils/updateNotificationSettings.ts` | 28 |  |
| ≈00:28.35–00:29.00 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:29.00–00:29.65 | 実行中 | `src/app/(main)/home/_components/CompletedTodos.tsx` | 115-120 |  |
| ≈00:29.00–00:29.65 | 実行中 | `src/lib/constants/completed.ts` | 1, 14 |  |
| ≈00:29.00–00:29.65 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:29.00–00:29.65 | 実行中 | `src/lib/utils/getUnfilteredCompletedJournalInput.ts` | 10-11, 13-17 |  |
| ≈00:31.44–00:31.94 | 実行中 | `src/app/(main)/home/_components/CompletedTodos.tsx` | 115-120 |  |
| ≈00:31.44–00:31.94 | 実行中 | `src/lib/constants/completed.ts` | 1, 14 |  |
| ≈00:31.44–00:31.94 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:31.44–00:31.94 | 実行中 | `src/lib/utils/getUnfilteredCompletedJournalInput.ts` | 10-11, 13-17 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126-128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/ui/form.tsx` | 48-53, 55-56, 59, 61, 63-68, 111-112, 115, 119-121, 123, 125, 142-144, 146-147, 156, 158 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/ui/input.tsx` | 5, 7-17 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 413, 415, 417-418, 421-424, 430-432 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/lib/category-sync-channel.ts` | 86 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:32.47–00:32.97 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:32.47–00:32.97 | 実行中 | `src/lib/utils.ts` | 5-7, 48 | ★ |
| ≈00:34.23–00:34.73 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 134-135 | ★ |
| ≈00:34.23–00:34.73 | 実行中 | `src/components/ui/sidebar.tsx` | 97-100, 103-104 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/AddTodoForm.tsx` | 45, 49-51, 53, 55, 61, 63, 66-67, 69, 84, 86, 101, 103, 106-113, 118, 129, 131, 136-137, 139-140, 144-146, 149-153, 163-168 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/CompletedTodos.tsx` | 66, 69-75, 79, 81, 85, 88, 92-95, 100-102, 106, 115-120, 123-124, 127-128, 130, 133, 145, 148, 151-152, 155, 170, 178, 180, 182-185, 188-190, 192-199, 223-224, 261-262, 265-272, 276, 281, 285-293, 297, 299, 303, 305, 309, 311-312, 314-316, 318-321 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/CompletedTodosFilters.tsx` | 68, 77-81, 83-84, 87-88, 90-96, 102, 105-106, 122, 144-145, 147, 153, 158, 161, 164, 167-168, 170, 177-178, 180, 183, 209-210, 212, 220, 223, 232, 235, 237, 239, 245, 247, 256, 260, 273, 277-280, 282-284, 294-297, 303-306, 313-316, 318, 329-330 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/ContributionGraph.tsx` | 188-192, 199-200, 202, 225, 234, 243, 245-246, 248, 250, 256, 262, 266-267, 270, 272, 276-278, 280-281, 283, 285-289, 307, 310-317, 319-325, 327, 329, 331, 333, 342, 347-349, 351-373, 375-392, 407, 411, 413-414, 418, 420, 424-426, 428, 430, 433, 436-439, 441, 443-444, 446, 467-472, 474-485, 487-492, 503-506, 508, 510, 512-514, 525-527, 529-530, 540-544, 559-561, 580-587 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/DayDetailDialog.tsx` | 63-75, 81-82, 88-89, 95-96, 102-104, 177-200, 202-205, 207, 212-213, 236, 238, 240, 242, 244, 246-253, 255-260, 364, 372 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/SortableTodoItem.tsx` | 43 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/SundayDigestCard.tsx` | 60-69, 71-74, 107-111, 113-114, 146-160, 182, 186-187, 191-194, 199-202, 211-212, 214, 217, 219-221, 229-230, 239, 250, 263, 265, 287, 290-292 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/TodoList.tsx` | 117-118, 120-121, 124, 127, 130, 138, 144-145, 148, 151-152, 154, 159, 161, 163-164, 169, 172, 180, 191, 197, 203-204, 212-214, 216, 228, 237-238, 248, 252-253, 263, 267-268, 279, 283-284, 293, 298-299, 305-306, 308-309, 311-312, 314-315, 325-328, 331, 333, 336, 340, 342-343, 360-363, 365, 367, 369, 381, 406, 410, 417, 434, 487-488, 490, 508, 512, 516, 521, 527, 529, 531, 538, 541-548, 551-553, 555, 557, 560-561, 579-586, 591, 595, 599-600, 604-606, 608-612, 614, 616, 618-620, 650-651, 654-658, 660-663, 667-673, 680-686, 689, 693-696, 698-702 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/WeeklySummaryCard.tsx` | 41-48, 50-52, 57-59, 76, 79-80, 83-86, 88-89, 96, 98, 100-107, 109-111, 113, 135-137 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/app/(main)/home/_components/YearInReviewModal.tsx` | 114, 118-121, 128, 130, 139, 157-160, 163-164, 166, 184-185, 187, 189, 191, 193, 195, 271, 283-285 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/grid.tsx` | 6-9 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/import/paste-import-types.ts` | 100 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/alert-dialog.tsx` | 9, 11-12, 23, 25, 27, 47, 50, 52-56, 59-62, 133 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/badge.tsx` | 28, 31, 34-35, 38-42 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/calendar.tsx` | 215 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/card.tsx` | 5, 7-9, 12-14, 18, 20-22, 25-27, 31, 33-37, 41, 43-47, 64, 66-70, 74 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/collapsible.tsx` | 23 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/dialog.tsx` | 9, 11-12, 21, 23-24, 49, 52, 56, 58-79 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/select.tsx` | 9, 11-12, 53, 56, 58, 60-63, 65-66, 68-74, 76-84 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/skeleton.tsx` | 5 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/toggle-group.tsx` | 67 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/components/ui/tooltip.tsx` | 8-9, 11, 13-17 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/use-mounted.ts` | 14, 39, 41-44 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/use-update-effect.ts` | 37-42, 44-45, 48, 50-55, 57 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useElectronNotifications.ts` | 82-84, 86, 88-92, 94, 103, 105, 121, 123, 143, 145, 155, 157, 167, 169, 206, 208-219 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useHeatmapData.ts` | 46-47, 53-54, 56, 69-70, 75, 78-79, 81, 83, 86-88, 90 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useKeyboardNav.ts` | 36, 44-46, 48-49, 81-82 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useLocalDayKey.ts` | 70-72, 90, 92-95 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useSoundFeedback.ts` | 29-34, 40, 42, 44, 51 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useStreakNotifications.ts` | 166, 172-173, 180-181, 191, 194, 196-197, 216-217, 239-249 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useTodoMutations.ts` | 100, 102, 104, 114, 121-122, 127-128, 131, 135-136, 183, 188-189, 424, 450-451, 456-457, 537, 542-543, 611, 616-617, 629, 651, 674, 702-703, 708-709, 752, 762, 767-768, 770, 778 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/hooks/useTodoPasteImport.ts` | 53-56, 59-60, 65, 71, 74, 78, 80, 84, 86, 88, 90, 100 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/aggregate-last-seven-days.ts` | 97-100, 105-106, 108-111, 127, 129-130, 160-162, 164, 166-167, 169-170, 175-176, 178-186, 190, 192-198 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/aggregate-year-in-review.ts` | 207 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/audio/soundEngine.ts` | 317 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/calc-streak.ts` | 190 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/category-sync-channel.ts` | 86 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/constants/completed.ts` | 1, 14 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/constants/heatmap.ts` | 1 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/constants/settings.ts` | 40 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/export-day-as-image.ts` | 292 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/getLocalTodayIsoDate.ts` | 18-21 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/heatmap-intensity.ts` | 15, 56-57, 62 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/interceptBulkPaste.ts` | 39 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/shiftIsoDate.ts` | 23-28 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/toLocalDayKey.ts` | 18-20, 29, 56-70, 74-75 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/utils.ts` | 5-7, 48 | ★ |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/utils/getMillisecondsUntilNextLocalDay.ts` | 15 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/utils/getUnfilteredCompletedJournalInput.ts` | 10-11, 13-17 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/lib/utils/updateNotificationSettings.ts` | 28 |  |
| ≈00:35.51–00:36.01 | 実行中 | `src/server/schemas/completed.ts` | 301 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/lib/constants/query.ts` | 3 |  |
| 00:36.13–00:36.55 | 操作#1224 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:36.13–00:36.55 | 操作#1224 | `src/lib/utils.ts` | 48 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/lib/constants/query.ts` | 3 |  |
| 00:36.55–00:36.67 | 操作#1232 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:36.55–00:36.67 | 操作#1232 | `src/lib/utils.ts` | 48 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/lib/constants/query.ts` | 3 |  |
| 00:36.67–00:36.89 | 操作#1246 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:36.67–00:36.89 | 操作#1246 | `src/lib/utils.ts` | 48 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/lib/constants/query.ts` | 3 |  |
| 00:36.89–00:37.18 | 操作#1262 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:36.89–00:37.18 | 操作#1262 | `src/lib/utils.ts` | 48 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/lib/constants/query.ts` | 3 |  |
| 00:37.18–00:37.32 | 操作#1273 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:37.18–00:37.32 | 操作#1273 | `src/lib/utils.ts` | 48 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/lib/constants/query.ts` | 3 |  |
| 00:37.32–00:37.61 | 操作#1289 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:37.32–00:37.61 | 操作#1289 | `src/lib/utils.ts` | 48 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/lib/category-sync-channel.ts` | 86 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:37.61–00:38.11 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:37.61–00:38.11 | 実行中 | `src/lib/utils.ts` | 48 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/lib/category-sync-channel.ts` | 86 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:38.47–00:38.97 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:38.47–00:38.97 | 実行中 | `src/lib/utils.ts` | 48 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/lib/constants/query.ts` | 3 |  |
| 00:39.15–00:39.27 | 操作#1381 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:39.15–00:39.27 | 操作#1381 | `src/lib/utils.ts` | 48 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/lib/constants/query.ts` | 3 |  |
| 00:39.27–00:39.71 | 操作#1407 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:39.27–00:39.71 | 操作#1407 | `src/lib/utils.ts` | 48 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126, 128, 130-132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/lib/category-sync-channel.ts` | 86 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/lib/constants/query.ts` | 3 |  |
| 00:39.71–00:40.00 | 操作#1422 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:39.71–00:40.00 | 操作#1422 | `src/lib/utils.ts` | 48 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 97-100, 103-104, 381, 383-388, 665 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:40.00–00:40.50 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:40.00–00:40.50 | 実行中 | `src/lib/utils.ts` | 48 |  |
| ≈00:40.50–00:41.00 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:41.83–00:42.33 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:41.83–00:42.33 | 実行中 | `src/lib/utils.ts` | 48 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:42.71–00:43.21 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:42.71–00:43.21 | 実行中 | `src/lib/utils.ts` | 48 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/lib/constants/query.ts` | 3 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:43.62–00:43.78 | 操作#1681 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:43.62–00:43.78 | 操作#1681 | `src/lib/utils.ts` | 48 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/lib/constants/query.ts` | 3 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:43.78–00:43.93 | 操作#1704 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:43.78–00:43.93 | 操作#1704 | `src/lib/utils.ts` | 48 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/lib/constants/query.ts` | 3 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:43.93–00:44.09 | 操作#1728 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:43.93–00:44.09 | 操作#1728 | `src/lib/utils.ts` | 48 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/lib/constants/query.ts` | 3 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:44.09–00:44.22 | 操作#1749 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:44.09–00:44.22 | 操作#1749 | `src/lib/utils.ts` | 48 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/hooks/use-mobile.ts` | 41 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/lib/constants/query.ts` | 3 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| 00:44.22–00:44.41 | 操作#1774 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:44.22–00:44.41 | 操作#1774 | `src/lib/utils.ts` | 48 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88-92, 94, 100, 105, 110-112, 114-116, 120, 122-124, 126, 128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 665 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75, 77-80, 82-84, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/lib/category-sync-channel.ts` | 10-12, 14, 20-21, 23, 25-26, 33-34, 36, 38-39, 47-49, 51, 53-58, 74-78, 86 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65, 77 |  |
| ≈00:44.41–00:44.91 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:44.41–00:44.91 | 実行中 | `src/lib/utils.ts` | 48 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/app/(main)/home/_components/Category.tsx` | 57, 61-66, 69-71, 74-75, 77-78, 82-85, 88, 94, 100, 105, 110, 123-124, 126-128, 130, 132, 134-136, 138, 143, 146-149, 156-166, 169, 182-183, 185-196, 216, 229, 231-232 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/components/ui/input.tsx` | 5, 7-10, 15-17 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/components/ui/popover.tsx` | 8, 10-11, 20, 22-23, 25, 27-32, 35-38 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/components/ui/sidebar.tsx` | 49-53, 55, 381, 383-388, 413, 415, 417-418, 421-424, 430-432 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/hooks/use-mobile.ts` | 41 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/hooks/useCategoryMutations.ts` | 36-37, 40, 43, 48-49, 86, 91-92, 120, 125-126, 154, 156, 160 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105, 121, 126, 139 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/lib/category-sync-channel.ts` | 86 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:45.06–00:45.56 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:45.06–00:45.56 | 実行中 | `src/lib/utils.ts` | 48 |  |
| ≈00:47.01–00:47.51 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:50.97–00:51.47 | 実行中 | `src/lib/orpc/create-client.ts` | 18-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-65 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 33-37, 40-41, 43-44, 47-49, 51, 53, 57, 59, 67, 73, 75, 79, 81-82, 85, 89-97, 99, 103-104 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/braindump/braindumpUtils.ts` | 21, 79-81, 83-84, 90, 101, 337-339, 341 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/import/paste-import-types.ts` | 77-82, 84-86, 88-90, 92-100 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/import/PasteImport.tsx` | 93-104, 106-112, 114-116, 118-129, 131-132, 134-135, 139-141, 143, 146-147, 178, 180, 220, 222-234, 236 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/import/PasteImportDialog.tsx` | 54, 115, 125-127, 130-133, 137-139, 142-144, 146, 150-152, 154, 157, 160, 165, 167, 169-172, 174, 179, 181, 183, 185, 192, 194, 201, 205, 207, 209, 211, 213, 224-225, 227-229, 233, 235, 237-240, 243-246, 248-251, 255, 261-262, 265, 273, 276-278, 280, 282, 290, 296-297, 299, 301-302, 305-307, 310-322, 326, 328, 331, 335, 337-343, 345-353, 358-364, 378, 382-383, 385-387, 389, 391-393, 398-399, 412, 436-437, 439, 441, 449, 470-471, 553 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/ui/alert-dialog.tsx` | 133 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/ui/dialog.tsx` | 9, 11-12, 21, 23-24, 33, 36, 38-45, 49, 52, 56, 58-62, 65-69, 77-79, 83, 85-89, 93, 95-102, 106, 109, 111-115, 119, 122, 124-128 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/ui/select.tsx` | 9, 11-12, 21, 23-24, 27, 29, 34, 36-49, 53, 56, 58, 60-84, 138, 141, 143-152, 156, 159, 161-170 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/components/ui/textarea.tsx` | 5, 7-14 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/hooks/useCategoryMutations.ts` | 125 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/constants/import.ts` | 20 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/constants/query.ts` | 3 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/orpc/create-client.ts` | 77 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/parsePasteToTasks.ts` | 72-76, 78-81, 85, 87-92, 94, 116-126 |  |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| ≈00:55.73–00:56.23 | 実行中 | `src/lib/utils.ts` | 5-7, 48 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/app/(main)/home/_components/CompletedImportEntry.tsx` | 33-37, 40-41, 43-44, 47-49, 51, 53, 57, 59, 67, 73, 75, 79, 81-82, 85, 89-97, 99, 103-104 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/components/braindump/braindumpUtils.ts` | 21, 79-81, 83-84, 90, 101, 337-339, 341 |  |
| 00:56.87–00:59.17 | 末尾 | `src/components/code-inspector/CodeInspectorClient.tsx` | 14 |  |
| 00:56.87–00:59.17 | 末尾 | `src/components/import/paste-import-types.ts` | 77-82, 84-86, 88-90, 92-100 |  |
| 00:56.87–00:59.17 | 末尾 | `src/components/import/PasteImport.tsx` | 93-104, 106-112, 114-116, 118-129, 131-132, 134-141, 143, 146-147, 178, 180, 220, 222-234, 236 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/components/import/PasteImportDialog.tsx` | 54, 115, 125-127, 130-133, 137-139, 142-144, 146, 150-152, 154, 157, 160-165, 167, 169-172, 174, 179, 181, 183, 185, 192, 194, 201, 205, 207, 209, 211, 213, 224-225, 227-229, 233, 235, 237-240, 243-246, 248-251, 255, 261-262, 265, 273, 276-278, 280, 282, 290, 296-297, 299, 301-302, 305-307, 310-322, 326, 328, 331, 335, 337-343, 345-353, 358-364, 378, 382-383, 385, 387, 391-392, 398-399, 412, 436-437, 439, 441, 449, 470-471, 553 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/components/ui/alert-dialog.tsx` | 133 |  |
| 00:56.87–00:59.17 | 末尾 | `src/components/ui/button.tsx` | 38, 42, 47-48, 51-55 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/components/ui/dialog.tsx` | 9, 11-12, 21, 23-24, 33, 36, 38-40, 43-45, 49, 52, 56, 58-62, 65-69, 77-79, 93, 95-97, 100-102 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/components/ui/textarea.tsx` | 5 |  |
| 00:56.87–00:59.17 | 末尾 | `src/hooks/use-cycle-effect.ts` | 30-37 |  |
| 00:56.87–00:59.17 | 末尾 | `src/hooks/useCategoryMutations.ts` | 125 |  |
| 00:56.87–00:59.17 | 末尾 | `src/hooks/useClerkQueryReady.ts` | 18-20 |  |
| 00:56.87–00:59.17 | 末尾 | `src/hooks/useSelectedCategory.ts` | 28-31, 33-34, 36-37, 82, 86-90, 92, 103, 105 |  |
| 00:56.87–00:59.17 | 末尾 | `src/lib/constants/import.ts` | 20 |  |
| 00:56.87–00:59.17 | 末尾 | `src/lib/constants/query.ts` | 3 |  |
| 00:56.87–00:59.17 | 末尾 | `src/lib/orpc/create-client.ts` | 77 |  |
| 00:56.87–00:59.17 | 末尾 | `src/lib/parsePasteToTasks.ts` | 72-76, 78-81, 85, 87-92, 94, 116-126 |  |
| 00:56.87–00:59.17 | 末尾 | `src/lib/query/createQueryClient.ts` | 17-20 | ★ |
| 00:56.87–00:59.17 | 末尾 | `src/lib/utils.ts` | 48 |  |

## 3. ファイル別逆引き（ファイル → 全実行行 → 実行時刻 → 直接証拠）

### `electron/types/ipc.ts`

- **全実行行** (6行): 1, 8, 102-105
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/app/(main)/home/_components/AddTodoForm.tsx`

- **全実行行** (119行): 1-5, 7-23, 25-29, 45, 49-53, 55-61, 63, 66-67, 69, 73-84, 86, 100-101, 103, 106-118, 120-132, 135-142, 144-146, 148-168, 170
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C,V] (16行): 45, 55, 69, 76, 107, 109, 113, 120, 125, 131, 135, 137, 141, 149, 153, 157

### `src/app/(main)/home/_components/Category.tsx`

- **全実行行** (152行): 1, 3-10, 12-44, 57, 61-66, 69-71, 74-78, 81-85, 88-94, 100, 104-105, 110-112, 114-116, 120, 122-124, 126-128, 130-132, 134-136, 138, 142-143, 146-166, 169-176, 178-183, 185-197, 199-200, 215-216, 219, 229-232, 234
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:34.23–00:34.73 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)
- **録画直接証拠行** [C,V] (13行): 57, 110, 134, 147, 150, 154, 158-159, 169, 171, 185, 196-197

### `src/app/(main)/home/_components/CategoryManageDialog.tsx`

- **全実行行** (124行): 1, 3-10, 12-39, 53, 56-58, 61-63, 66-68, 71-75, 81, 87-88, 93, 96-97, 102, 111-112, 117, 120-121, 126, 132-133, 135-137, 139, 141-142, 144, 147-148, 150, 153-154, 156-158, 161-166, 169-170, 172-174, 176, 264-267, 270-278, 290-305, 307
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)
- **録画直接証拠行** [C] (1行): 53

### `src/app/(main)/home/_components/CompletedDropZone.tsx`

- **全実行行** (7行): 1, 3-4, 11, 30, 35, 62
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/app/(main)/home/_components/CompletedImportEntry.tsx`

- **全実行行** (57行): 1, 3-5, 7-14, 33-37, 40-44, 47-49, 51-53, 57-59, 67, 72-73, 75, 78-79, 81-83, 85, 89-97, 99-104, 106
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C,V] (3行): 47, 82-83

### `src/app/(main)/home/_components/CompletedJournalRow.tsx`

- **全実行行** (8行): 1-2, 4-7, 38, 94
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/app/(main)/home/_components/CompletedTodos.tsx`

- **全実行行** (155行): 1-3, 5, 7-27, 30-35, 54-57, 66, 69-75, 79, 81-85, 88, 92-95, 100-102, 106, 114-124, 127-130, 133, 144-145, 148, 151-152, 155-156, 161-163, 165-167, 169-170, 178-180, 182-185, 188-190, 192-199, 222-224, 261-262, 265-274, 276-293, 297, 299, 303, 305, 309, 311-312, 314-316, 318-321, 323
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:29.00–00:29.65 (実行中) / ≈00:31.44–00:31.94 (実行中) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C,V] (14行): 66, 190, 195-196, 271-274, 277, 286-288, 314, 318

### `src/app/(main)/home/_components/CompletedTodosFilters.tsx`

- **全実行行** (213行): 1, 3-5, 8-27, 47-50, 52-59, 68, 77-81, 83-84, 87-98, 100, 102, 105-114, 121-128, 130-135, 137-142, 144-145, 147-149, 152-170, 172-181, 183-191, 201-205, 207-210, 212-225, 227-228, 230-235, 237, 239-242, 245, 247-254, 256-261, 272-274, 276-280, 282-284, 294-306, 313-316, 318, 329-330
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C,V] (10行): 68, 106, 124, 131, 138, 156, 163, 168, 297, 302

### `src/app/(main)/home/_components/ContributionGraph.tsx`

- **全実行行** (293行): 1, 3-5, 7, 9-25, 27-37, 39, 41-42, 44-45, 47-48, 50-51, 53-54, 56-57, 59, 64-65, 67, 76-83, 85-86, 88-89, 99, 103-115, 117, 125, 128, 130, 136, 145, 147, 149-150, 169, 178, 188-192, 199-200, 202, 208-209, 223-225, 234-243, 245-246, 248, 250, 256, 262, 265-270, 272, 276-278, 280-281, 283, 285-289, 307, 310-317, 319-325, 327, 329-331, 333, 335-337, 339-342, 347-349, 351-373, 375-392, 394, 396, 406-407, 411, 413-414, 418, 420, 424-426, 428, 430, 433, 436-439, 441, 443-444, 446, 467-472, 474-485, 487-492, 494, 502-506, 508, 510, 512-514, 516, 524-527, 529-530, 532, 539-544, 546, 558-561, 563, 579-587
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C,V] (19行): 188, 234, 272, 285, 336-337, 340, 348-349, 351, 353, 355-356, 358, 375-376, 378, 384, 580

### `src/app/(main)/home/_components/DayDetailDialog.tsx`

- **全実行行** (109行): 1, 3-6, 8-29, 52, 62-75, 81-82, 88-89, 95-96, 102-104, 106, 120, 129, 131, 147, 163, 177-200, 202-205, 207, 212-213, 236, 238, 240, 242, 244, 246-253, 255-260, 364, 372
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (2行): 177, 195

### `src/app/(main)/home/_components/LogoutButton.tsx`

- **全実行行** (8行): 1, 3-4, 6-7, 9-10, 29
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/app/(main)/home/_components/retroactivePopulateFade.ts`

- **全実行行** (5行): 10, 19-20, 26, 60
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/app/(main)/home/_components/SortableTodoItem.tsx`

- **全実行行** (8行): 1, 3-4, 6, 8, 43, 52, 78
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/app/(main)/home/_components/SundayDigestCard.tsx`

- **全実行行** (98行): 1, 3-4, 6-8, 10-14, 16, 20-21, 23, 25-26, 28, 32-33, 46, 59-69, 71-74, 76, 87, 96, 98, 106-111, 113-114, 116, 121, 129, 131, 145-160, 182, 186-187, 191-194, 199-202, 211-212, 214, 216-217, 219-221, 229-230, 239, 250, 263, 265, 287, 290-292, 294
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/app/(main)/home/_components/TodoItem.tsx`

- **全実行行** (24行): 1-9, 11-22, 59, 80, 248
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/app/(main)/home/_components/TodoList.tsx`

- **全実行行** (286行): 1-12, 14-49, 52-62, 64-65, 67-69, 71, 86-93, 108, 117-118, 120-121, 124, 127, 130, 138, 144-145, 148, 151-154, 159, 161-164, 169, 172, 180-182, 186-192, 196-197, 203-204, 212-214, 216, 228, 237-238, 248, 252-253, 263, 267-268, 279, 283-284, 293, 298-299, 305-312, 314-315, 325-328, 331-333, 336, 340-343, 360-363, 365, 367-369, 381-382, 401, 403-406, 410-411, 416-417, 434, 484, 487-488, 490, 498, 506-508, 512, 514-516, 521, 527, 529, 531-533, 535-538, 541-548, 551-561, 565, 579-586, 591-606, 608-612, 614, 616, 618-620, 650-651, 654-658, 660-663, 667-673, 680-689, 692-696, 698-702, 704
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C,V] (24行): 117, 203, 515, 527, 541, 551-557, 561, 581-582, 600, 609-612, 616, 654-655, 668

### `src/app/(main)/home/_components/WeeklySummaryCard.tsx`

- **全実行行** (54行): 1, 3, 5, 7-13, 28, 40-48, 50-52, 57-59, 76, 79-80, 83-86, 88-89, 96, 98, 100-107, 109-111, 113, 132, 135-137, 139
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [V] (5行): 84-86, 89, 109

### `src/app/(main)/home/_components/YearInReviewModal.tsx`

- **全実行行** (67行): 1, 3-5, 7-16, 18-26, 28, 38-39, 50, 60, 75, 77, 85, 93, 114, 118-122, 128, 130, 139, 157-160, 163-164, 166, 184-185, 187-189, 191-193, 195, 263, 271, 283-285, 287, 289, 295-296, 319
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/app/(main)/home/page.tsx`

- **全実行行** (19行): 1, 3, 5, 9, 11-12, 14-24, 26, 28
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)
- **録画直接証拠行** [V] (6行): 15-18, 21-22

### `src/app/error.tsx`

- **全実行行** (22行): 1, 3, 13-15, 17-26, 35, 49-50, 55, 61, 91, 93
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/app/global-error.tsx`

- **全実行行** (75行): 1, 3, 22, 24, 33-48, 50-58, 60-64, 66-71, 73-78, 80-90, 92-98, 100, 111-112, 119, 122, 135-136, 140, 161, 171, 173
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/app/login/[[...login]]/page.tsx`

- **全実行行** (33行): 1, 3, 5-9, 11-12, 14, 26, 43, 45, 60-63, 66-67, 70-72, 75, 77-79, 84-85, 101-103, 105, 107
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)
- **録画直接証拠行** [V] (3行): 77-78, 84

### `src/components/AppSidebar.tsx`

- **全実行行** (248行): 1, 3-19, 21-48, 50, 52, 59-64, 66-71, 73-81, 84-132, 134-135, 137-154, 156-167, 169-174, 176-185, 188-212, 214, 216, 218, 220-222, 226-241, 243-276, 278
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)
- **録画直接証拠行** [C,V] (50行): 59, 85-88, 91, 95-97, 105-106, 112, 176-180, 188-191, 193-195, 199, 204-206, 214, 216, 218, 220-222, 226-229, 232-235, 243-245, 251, 253, 259, 261, 267

### `src/components/auth/ElectronLoginForm.tsx`

- **全実行行** (36行): 1, 3-6, 9-13, 15, 61, 72, 126, 397, 399, 402-408, 410-413, 415-417, 425-430
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/components/braindump/braindumpUtils.ts`

- **全実行行** (25行): 1, 21, 31, 34, 79-81, 83-84, 90, 101, 121, 150, 176, 200, 231, 262, 264, 269-270, 324, 337-339, 341
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/components/code-inspector/CodeInspectorClient.tsx`

- **全実行行** (6行): 1, 14-18
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:09.39–00:09.89 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/components/electron/ElectronStartupSync.tsx`

- **全実行行** (29行): 1, 3, 29, 31-36, 38, 40, 56, 72, 99-101, 111-114, 116-117, 122-125, 127-128, 130
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/components/grid.tsx`

- **全実行行** (6行): 3, 6-10
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (1行): 6

### `src/components/import/ImportUndoBanner.tsx`

- **全実行行** (44行): 1, 3-5, 7, 9-11, 42, 46, 51-53, 61-62, 64-72, 74-77, 79, 93, 96-97, 99, 139, 142-143, 148, 155, 158, 179, 181-183, 185
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/components/import/paste-import-types.ts`

- **全実行行** (25行): 1, 10, 12-13, 77-82, 84-86, 88-90, 92-100
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/components/import/PasteImport.tsx`

- **全実行行** (82行): 1, 3-4, 6-7, 9-11, 14-18, 20-21, 23, 27-28, 93-104, 106-112, 114-116, 118-129, 131-132, 134-141, 143, 146-147, 178, 180, 220, 222-234, 236
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C] (3行): 93, 109, 134

### `src/components/import/PasteImportDialog.tsx`

- **全実行行** (233行): 1, 3-4, 6, 8-26, 29-33, 35, 39-42, 50-62, 115, 125-127, 130-133, 137-139, 142-144, 146, 150-152, 154, 156-157, 160-165, 167, 169-172, 174, 177-179, 181-183, 185, 191-192, 194, 200-201, 205-207, 209-211, 213, 224-225, 227-229, 233-235, 237-240, 243-246, 248-251, 253-255, 259, 261-262, 265-273, 276-292, 295-299, 301-302, 305-307, 310-322, 326, 328, 331, 335, 337-343, 345-353, 357-364, 366, 368, 377-378, 382-383, 385-387, 389, 391-393, 398-399, 401, 403, 411-412, 436-437, 439, 441, 449, 470-471, 473, 475, 484-485, 553, 589
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C,V] (19行): 115, 167, 240, 251, 253, 259, 265, 276-278, 284, 289, 301, 305, 310, 337-338, 346, 386

### `src/components/ThemePreviewSwatch.tsx`

- **全実行行** (4行): 2, 23, 61, 66
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ThemeSelector.tsx`

- **全実行行** (22行): 1, 3, 6-10, 12-14, 17-24, 36, 46, 95, 153
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ThemeSelectorMenuItem.tsx`

- **全実行行** (24行): 1, 3, 5-23, 34, 43, 117
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/alert-dialog.tsx`

- **全実行行** (40行): 1, 3-4, 6-7, 9, 11-12, 15, 19, 23, 25, 27, 31, 43, 47, 50, 52-62, 66, 75, 79, 91, 95, 104, 108, 117, 121, 129, 133, 141
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/components/ui/avatar.tsx`

- **全実行行** (31行): 1, 3-4, 6, 8, 11, 13-20, 24, 27, 29-33, 37, 40, 42-49
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/badge.tsx`

- **全実行行** (33行): 1-3, 5, 7-26, 28, 31, 34-35, 38-42
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/components/ui/button.tsx`

- **全実行行** (43行): 1-3, 5, 7-36, 38, 42, 47-48, 51-55
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C] (1行): 38

### `src/components/ui/calendar.tsx`

- **全実行行** (17行): 1, 3-8, 10, 12-14, 16, 175, 177, 186, 211, 215
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/components/ui/card.tsx`

- **全実行行** (42行): 1, 3, 5, 7-14, 18, 20-27, 31, 33-37, 41, 43-47, 51, 60, 64, 66-70, 74, 80
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (1行): 64

### `src/components/ui/checkbox.tsx`

- **全実行行** (7行): 1, 3-5, 7, 9, 28
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/collapsible.tsx`

- **全実行行** (18行): 1, 3-4, 6, 8-9, 12, 14, 16-19, 23, 25, 27-30
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/components/ui/dialog.tsx`

- **全実行行** (80行): 1, 3-5, 7, 9, 11-12, 15, 17-18, 21, 23-24, 27, 30, 33, 36, 38-45, 49, 52, 56, 58-79, 83, 85-89, 93, 95-102, 106, 109, 111-115, 119, 122, 124-128
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C,V] (6行): 59-60, 70, 74-75, 83

### `src/components/ui/dropdown-menu.tsx`

- **全実行行** (51行): 1, 3-5, 7, 9, 11-12, 19, 23, 25, 27-30, 34, 36, 38, 40-50, 54, 58, 62, 81, 85, 107, 111, 118, 122, 142, 146, 162, 166, 175, 179, 191, 195, 198, 201, 221, 225, 237
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/form.tsx`

- **全実行行** (80行): 1, 4-14, 16-17, 19, 28-30, 32, 35-36, 39-41, 45-46, 48-53, 55-56, 59, 61, 63-69, 75-77, 79-81, 84-90, 94, 98, 107, 111-112, 115-117, 119-121, 123-125, 129-130, 138, 142-144, 146-147, 156, 158
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中)
- **録画直接証拠行** [C,V] (2行): 85, 111

### `src/components/ui/input.tsx`

- **全実行行** (14行): 1, 3, 5, 7-17
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)
- **録画直接証拠行** [C] (2行): 5, 17

### `src/components/ui/label.tsx`

- **全実行行** (6行): 1, 3-4, 6, 8, 20
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/popover.tsx`

- **全実行行** (28行): 1, 3-4, 6, 8, 10-11, 14, 16-17, 20, 22-23, 25, 27-38, 42, 45
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)
- **録画直接証拠行** [C,V] (2行): 20, 28

### `src/components/ui/radio-group.tsx`

- **全実行行** (9行): 1, 3-5, 7, 9, 18, 22, 41
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/components/ui/select.tsx`

- **全実行行** (103行): 1, 3-5, 7, 9, 11-12, 15, 18, 21, 23-24, 27, 29, 34, 36-49, 53, 56, 58, 60-84, 88, 97, 101, 105, 107-121, 125, 134, 138, 141, 143-152, 156, 159, 161-170
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中) / ≈00:55.73–00:56.23 (実行中)
- **録画直接証拠行** [V] (1行): 47

### `src/components/ui/separator.tsx`

- **全実行行** (18行): 1, 3-4, 6, 8, 10-11, 13, 15-24
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/sheet.tsx`

- **全実行行** (25行): 1, 3-5, 7, 9-10, 13, 16, 19, 22, 25, 28, 31, 43, 47, 80, 84, 90, 94, 100, 104, 113, 117, 126
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/sidebar.tsx`

- **全実行行** (312行): 1, 3, 5-7, 9-28, 30-35, 47, 49-53, 55, 58-59, 70-72, 76-78, 87-88, 91-93, 96-100, 103-105, 107-109, 113, 115, 123, 126-129, 131-135, 137-146, 150-153, 161-162, 164, 175, 179, 200, 205-212, 214-220, 222-229, 231, 233, 235-248, 252, 256-257, 260-266, 268-274, 278-279, 299, 303, 305-313, 317, 327, 331, 333-338, 342, 344-349, 353, 356, 358-363, 367, 369-377, 381, 383-388, 392, 394, 396-397, 400-409, 413, 415, 417-418, 421-425, 427-432, 436, 439, 441-446, 450, 452-457, 461, 463-468, 472-492, 494-498, 506-508, 510-518, 521-522, 532, 537, 539-540, 544, 572, 576, 594, 598, 607, 632, 636, 647, 651, 661, 665, 693
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:24.29–00:24.79 (実行中) / 00:24.90–00:25.01 (操作#781) / 00:25.01–00:25.21 (操作#783) / 00:25.21–00:25.35 (操作#794) / ≈00:25.35–00:25.85 (実行中) / 00:25.86–00:26.02 (操作#803) / 00:26.02–00:26.43 (操作#807) / ≈00:26.43–00:26.93 (実行中) / ≈00:27.23–00:27.73 (実行中) / ≈00:28.35–00:29.00 (実行中) / ≈00:32.47–00:32.97 (実行中) / ≈00:34.23–00:34.73 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)
- **録画直接証拠行** [C,V] (11行): 58, 128, 214, 225, 240, 272-273, 303, 381, 413, 494

### `src/components/ui/skeleton.tsx`

- **全実行行** (4行): 1, 3, 5, 11
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/components/ui/sonner.tsx`

- **全実行行** (20行): 1, 3-4, 6, 8, 10-11, 16-17, 20-22, 24-28, 34-36
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/components/ui/textarea.tsx`

- **全実行行** (11行): 1, 3, 5, 7-14
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/components/ui/toggle-group.tsx`

- **全実行行** (54行): 1, 3-5, 7-8, 10-12, 14-19, 22-34, 36, 38-43, 46, 49-65, 67
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/components/ui/toggle.tsx`

- **全実行行** (28行): 1, 3-5, 7, 9-29, 31, 43
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/components/ui/tooltip.tsx`

- **全実行行** (18行): 1, 3-4, 6, 8-9, 11, 13-17, 21, 27, 31, 34, 37, 57
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/use-cycle-effect.ts`

- **全実行行** (9行): 1, 30-37
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:09.39–00:09.89 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/hooks/use-initial-effect.ts`

- **全実行行** (6行): 1, 18-22
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/hooks/use-mobile.ts`

- **全実行行** (19行): 1, 3, 5, 9-14, 16, 19-22, 24, 27, 30, 40-41
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)

### `src/hooks/use-mounted.ts`

- **全実行行** (16行): 1, 3, 7-8, 10, 13-14, 16, 19-20, 39-44
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/use-update-effect.ts`

- **全実行行** (25行): 1-7, 37-42, 44-48, 50-55, 57
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/useCategoryMutations.ts`

- **全実行行** (53行): 1, 3, 5-6, 36-37, 40, 43, 48-51, 53-54, 56-65, 67-68, 72-73, 75-84, 86, 91-92, 110, 115, 118, 120, 125-126, 142, 147, 152, 154, 156, 160
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C] (3行): 36, 50, 82

### `src/hooks/useClerkQueryReady.ts`

- **全実行行** (5行): 1, 3, 18-20
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/hooks/useCompletionFeedback.ts`

- **全実行行** (9行): 1, 3, 5, 12-14, 43-45
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/hooks/useElectronNotifications.ts`

- **全実行行** (54行): 1, 3, 5-6, 8, 31-39, 59, 64, 80, 82-84, 86, 88-92, 94, 103, 105, 121, 123, 143, 145, 155, 157, 167, 169-173, 206, 208-219
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/useHeatmapData.ts`

- **全実行行** (26行): 1, 3-4, 6-7, 46-47, 52-56, 69-70, 72, 75-79, 81, 83, 86-88, 90
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (2行): 46, 52

### `src/hooks/useKeyboardNav.ts`

- **全実行行** (9行): 1, 36, 44-46, 48-49, 81-82
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/useLocalDayKey.ts`

- **全実行行** (44行): 1, 3, 5-6, 8, 14-16, 18, 23-26, 29-30, 32, 37, 41, 43, 48, 51, 53-55, 57-62, 64, 69-72, 74, 79, 82, 90-95
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (2行): 70, 90

### `src/hooks/useReducerState.ts`

- **全実行行** (3行): 1, 15, 21
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/hooks/useSelectedCategory.ts`

- **全実行行** (58行): 1, 3, 5, 7, 9, 12-13, 15, 17-18, 22, 24, 27-31, 33-34, 36-37, 39, 41-42, 44, 48-50, 52-53, 57-58, 60-64, 82, 86-90, 92, 102-103, 105, 108, 120-121, 126-127, 131, 133-134, 137-139
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/hooks/useSoundFeedback.ts`

- **全実行行** (19行): 1-2, 4-9, 29-34, 40-42, 44, 51
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (1行): 29

### `src/hooks/useStreakNotifications.ts`

- **全実行行** (70行): 1, 3-4, 7-9, 11-12, 15, 23-24, 26, 35, 38, 50, 57-79, 81, 93, 107, 109, 117, 125, 166, 172-174, 180-181, 191-194, 196-197, 216-217, 238-249
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/useThemeAxis.ts`

- **全実行行** (17行): 1, 3, 5-14, 21, 65, 67, 88, 120
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/hooks/useTodoMutations.ts`

- **全実行行** (92行): 1, 4-9, 11-15, 48, 61, 75, 100, 102, 104, 114-122, 127-131, 135-136, 168, 174, 181, 183, 188-190, 396-397, 424-425, 450-451, 456-457, 497, 509, 535, 537, 542-543, 582, 594, 609, 611, 616-618, 629-630, 647, 651-652, 657-659, 674-675, 702-703, 708-709, 721, 724, 727, 740, 746, 750, 752, 762-768, 770, 778
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/hooks/useTodoPasteImport.ts`

- **全実行行** (28行): 1, 3-4, 7-9, 53-56, 59-60, 65, 70-71, 74, 76-78, 80, 83-84, 86-88, 90, 92, 100
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/aggregate-last-seven-days.ts`

- **全実行行** (52行): 3, 5, 8-9, 11, 15-16, 18, 21-22, 81, 96-100, 105-106, 108-111, 127, 129-130, 160-162, 164, 166-167, 169-170, 175-176, 178-186, 190, 192-198
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/aggregate-year-in-review.ts`

- **全実行行** (10行): 3, 13, 54, 58-59, 142, 175, 197-198, 207
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/audio/soundEngine.ts`

- **全実行行** (43行): 1, 19, 21, 28, 30, 32-33, 35, 40-41, 43-44, 46, 49-50, 52-53, 55, 59-60, 62, 64, 69, 89, 91, 95, 105, 107, 112, 118, 120, 128, 160, 162, 171, 188, 190, 197, 226, 243, 283, 300, 317
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/buildDateSyncUrl.ts`

- **全実行行** (16行): 1, 22-26, 28-31, 33-38
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/calc-streak.ts`

- **全実行行** (9行): 3, 13, 55, 66, 73, 169, 171, 184, 190
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/calcMonthlyMaxDates.ts`

- **全実行行** (11行): 55-56, 58-62, 64, 85, 87-88
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/category-colors.ts`

- **全実行行** (12行): 1, 8, 12-19, 29-30
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/category-sync-channel.ts`

- **全実行行** (47行): 1-2, 6, 9-12, 14, 16, 19-21, 23, 25-26, 28, 32-34, 36, 38-39, 47-49, 51, 53-58, 68-70, 72, 74-78, 80, 82-86
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中)

### `src/lib/clearedAffirmation.ts`

- **全実行行** (3行): 1, 15, 21
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/constants/braindump.ts`

- **全実行行** (49行): 1, 15, 17-18, 21, 24, 30, 70, 81-86, 100, 103-107, 113-117, 120, 123, 126, 129, 132, 139, 154-159, 162, 176-177, 190, 193, 201, 204, 214, 238, 245, 248, 251
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/constants/completed.ts`

- **全実行行** (8行): 1-2, 4, 6, 8, 10, 12, 14
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:29.00–00:29.65 (実行中) / ≈00:31.44–00:31.94 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/constants/completionFeedback.ts`

- **全実行行** (8行): 1, 9-10, 18, 20, 22, 24, 27
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/constants/date.ts`

- **全実行行** (3行): 1-2, 5
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/constants/electronSettings.ts`

- **全実行行** (9行): 1, 8, 10, 13-18
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/constants/heatmap.ts`

- **全実行行** (2行): 1-2
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/constants/import.ts`

- **全実行行** (7行): 1, 11, 13, 20-21, 30, 39
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/lib/constants/query.ts`

- **全実行行** (3行): 1-3
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/lib/constants/settings.ts`

- **全実行行** (19行): 1, 14-15, 17, 22-25, 27-32, 34, 37-40
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/constants/sound.ts`

- **全実行行** (60行): 1, 13, 15, 18-19, 31, 55-57, 63-92, 95-96, 100, 103, 116-132
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/constants/theme.ts`

- **全実行行** (3行): 1, 8-9
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/dnd-kit-sensors.ts`

- **全実行行** (26行): 1, 8-11, 13, 21, 24, 26, 35, 38, 46-51, 53, 59, 71, 79-84
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/export-day-as-image.ts`

- **全実行行** (21行): 1, 5, 8, 23-31, 57, 60-61, 78, 208, 210, 221, 229, 292
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/formatClockTime.ts`

- **全実行行** (4行): 1, 13-14, 19
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/getLocalTodayIsoDate.ts`

- **全実行行** (5行): 1, 18-21
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)
- **録画直接証拠行** [C] (2行): 18-19

### `src/lib/heatmap-intensity.ts`

- **全実行行** (16行): 1, 13, 15, 19, 22, 25, 32-38, 56-57, 62
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/interceptBulkPaste.ts`

- **全実行行** (2行): 3, 39
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/isMultiLinePaste.ts`

- **全実行行** (3行): 1-2, 26
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/logger.ts`

- **全実行行** (43行): 1, 16-17, 19, 24-27, 29, 41-55, 62-64, 80, 95, 97, 107-108, 114-115, 121-122, 128-129, 135-136, 142-143, 145
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/orpc/client-query.ts`

- **全実行行** (6行): 1, 3, 5, 8-9, 21
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/orpc/create-client.ts`

- **全実行行** (33行): 1-2, 7, 16-19, 22-25, 29-30, 33, 35-37, 39-40, 52, 54, 56, 58-61, 64-67, 75-77
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / ≈00:18.62–00:21.13 (実行中) / ≈00:24.29–00:24.79 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:29.00–00:29.65 (実行中) / ≈00:31.44–00:31.94 (実行中) / ≈00:35.51–00:36.01 (実行中) / ≈00:40.00–00:40.50 (実行中) / ≈00:40.50–00:41.00 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:47.01–00:47.51 (実行中) / ≈00:50.97–00:51.47 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/lib/orpc/electron-auth-provider.tsx`

- **全実行行** (50行): 1, 3-4, 7, 9-10, 23-24, 27-32, 34-39, 43, 236, 244, 246-248, 250, 253-254, 256-258, 266, 274, 276, 279-280, 282-287, 316, 318-319, 354, 356, 367, 379
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:09.39–00:09.89 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/orpc/serializer.ts`

- **全実行行** (12行): 1, 3-13
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/parsePasteToTasks.ts`

- **全実行行** (34行): 1, 17, 19, 42, 47-48, 72-76, 78-81, 85, 87-92, 94, 116-126
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)

### `src/lib/paste-import-channel.ts`

- **全実行行** (34行): 1, 11, 13-14, 20, 27-30, 32, 34, 37-41, 43, 47-48, 53, 65, 73, 84-85, 87-88, 90, 92, 94-99
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/query/createQueryClient.ts`

- **全実行行** (24行): 1, 6, 10, 13-25, 29-31, 34-38
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C] (2行): 17, 19

### `src/lib/redux/foldLegacyCompletionSoundIntoMoments.ts`

- **全実行行** (5行): 1, 8-9, 12, 78
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/redux/hooks.ts`

- **全実行行** (5行): 1, 24-25, 39, 52
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/redux/migratePersistedState.ts`

- **全実行行** (9行): 1, 3-4, 8, 24, 29-31, 110
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/redux/providers.tsx`

- **全実行行** (17行): 1, 3, 31-33, 35, 37-41, 68, 70, 72-74, 76
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/redux/slices/electronSettingsSlice.ts`

- **全実行行** (44行): 1, 18-19, 21, 43-45, 51-55, 61-62, 64, 66, 72-73, 75, 77, 83-84, 86, 88, 93-94, 96-98, 101-106, 115-116, 124-125, 133-134, 142, 144, 146
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/redux/slices/settingsSlice.ts`

- **全実行行** (120行): 1, 23-24, 26, 37-39, 52, 58-62, 67-68, 70, 72, 76-77, 79, 81, 88-89, 98, 100, 111-112, 118, 120, 124-125, 127, 129, 134-135, 142, 144, 152-153, 163, 165, 171-172, 180, 182, 190-191, 198, 200, 205-206, 208, 210, 217-218, 226, 228, 235-236, 244, 246, 251-252, 254, 256, 259-260, 262-264, 267-282, 292-293, 300-301, 318-320, 322-328, 333, 340-341, 348-349, 356, 359, 366-367, 374-375, 382, 384, 391-392, 399, 401, 409, 425, 427
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/redux/store.ts`

- **全実行行** (38行): 1, 15-16, 20, 22, 24, 28-29, 31, 34-38, 45, 71-79, 81-82, 96-107
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/schemas/settings.ts`

- **全実行行** (73行): 1, 11-12, 14, 29, 36, 42-53, 62-83, 85-89, 92, 95-102, 105-107, 110-114, 117, 120-121, 124-128, 131, 134-135
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/settings-sync-channel.ts`

- **全実行行** (49行): 3-4, 19, 26-27, 34-55, 57, 60-62, 64, 72-73, 83, 103, 107-108, 110, 112, 114-117, 140, 142, 160-162
- **実行時刻**: ≈00:00.00–00:00.68 (実行中)

### `src/lib/shiftIsoDate.ts`

- **全実行行** (7行): 1, 23-28
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/themes/preview.ts`

- **全実行行** (48行): 1, 26, 33-44, 46-48, 50, 58-86, 127
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/themes/registry.ts`

- **全実行行** (217行): 1, 11, 13, 94-112, 114-119, 121-152, 154-189, 191-222, 224-255, 257-290, 293, 306-308, 311-312, 328-333, 350, 362-369, 377-378
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/lib/todo-sync-channel.ts`

- **全実行行** (33行): 1-2, 6, 13-16, 18, 20, 28-30, 32, 34-35, 37, 45-46, 52, 62, 71, 82-84, 86, 88, 92, 94, 96-100
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/toLocalDayKey.ts`

- **全実行行** (34行): 1, 7-8, 10, 17-29, 56-70, 74-75
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/utils.ts`

- **全実行行** (22行): 1, 3, 5-7, 15, 26-27, 29-30, 32, 34-43, 48
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:32.47–00:32.97 (実行中) / ≈00:35.51–00:36.01 (実行中) / 00:36.13–00:36.55 (操作#1224) / 00:36.55–00:36.67 (操作#1232) / 00:36.67–00:36.89 (操作#1246) / 00:36.89–00:37.18 (操作#1262) / 00:37.18–00:37.32 (操作#1273) / 00:37.32–00:37.61 (操作#1289) / ≈00:37.61–00:38.11 (実行中) / ≈00:38.47–00:38.97 (実行中) / 00:39.15–00:39.27 (操作#1381) / 00:39.27–00:39.71 (操作#1407) / 00:39.71–00:40.00 (操作#1422) / ≈00:40.00–00:40.50 (実行中) / ≈00:41.83–00:42.33 (実行中) / ≈00:42.71–00:43.21 (実行中) / 00:43.62–00:43.78 (操作#1681) / 00:43.78–00:43.93 (操作#1704) / 00:43.93–00:44.09 (操作#1728) / 00:44.09–00:44.22 (操作#1749) / 00:44.22–00:44.41 (操作#1774) / ≈00:44.41–00:44.91 (実行中) / ≈00:45.06–00:45.56 (実行中) / ≈00:55.73–00:56.23 (実行中) / 00:56.87–00:59.17 (末尾)
- **録画直接証拠行** [C] (1行): 5

### `src/lib/utils/getMillisecondsUntilNextLocalDay.ts`

- **全実行行** (6行): 1, 3, 12-15
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/utils/getNotificationSettings.ts`

- **全実行行** (3行): 1, 14, 22
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/lib/utils/getUnfilteredCompletedJournalInput.ts`

- **全実行行** (8行): 1, 10-11, 13-17
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:29.00–00:29.65 (実行中) / ≈00:31.44–00:31.94 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `src/lib/utils/resolveCompletedJournalDateRange.ts`

- **全実行行** (22行): 1, 12, 14, 21, 40-43, 45-47, 55-56, 62-63, 69-70, 76-77, 93-95
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812)

### `src/lib/utils/updateNotificationSettings.ts`

- **全実行行** (3行): 1, 19, 28
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / 00:28.23–00:28.35 (操作#812) / ≈00:35.51–00:36.01 (実行中)

### `src/providers/QueryClientProvider.tsx`

- **全実行行** (53行): 1, 3-7, 10-12, 14-19, 21-22, 24, 34-35, 39-41, 43-46, 48-49, 51, 77, 81-84, 87, 101-102, 104, 109, 111, 114, 116-117, 120-127, 129
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:09.39–00:09.89 (実行中) / ≈00:13.60–00:16.11 (実行中)
- **録画直接証拠行** [C] (2行): 34-35

### `src/providers/ThemeAllowlistGuard.tsx`

- **全実行行** (14行): 1, 3, 5-6, 8-9, 26-27, 29, 33-36, 38
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/providers/ThemeProvider.tsx`

- **全実行行** (35行): 1, 3, 5, 7-11, 14-15, 22, 33-38, 50, 53-54, 57-66, 69, 72-74, 76
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/providers/ThemeTransition.tsx`

- **全実行行** (27行): 1, 3-4, 6-7, 19, 23-25, 29-30, 32, 34-37, 40-43, 45-50, 52
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:13.60–00:16.11 (実行中)

### `src/server/schemas/category.ts`

- **全実行行** (41行): 1, 8-9, 12-19, 21, 29-41, 50-53, 59-62, 67-71, 78-80
- **実行時刻**: ≈00:13.60–00:16.11 (実行中)

### `src/server/schemas/completed.ts`

- **全実行行** (111行): 1, 3, 5, 16-17, 24-27, 35-38, 46-48, 64-68, 79-85, 97-100, 107-109, 119-121, 129-136, 150-155, 162-166, 173-180, 188-194, 201-202, 204-205, 220-232, 247-252, 262-270, 283, 296-301
- **実行時刻**: ≈00:13.60–00:16.11 (実行中) / ≈00:35.51–00:36.01 (実行中)

### `utils/electron-client.ts`

- **全実行行** (14行): 1, 15, 17, 27-30, 32, 42, 47, 63, 67, 74, 80
- **実行時刻**: ≈00:00.00–00:00.68 (実行中) / ≈00:09.39–00:09.89 (実行中) / ≈00:13.60–00:16.11 (実行中)

## 4. server-rendered ファイル（録画に可視・client JS 未実行 — honest union）

以下は rrweb がホスト要素をスタンプした = **録画の画面に映っていた**が、server component ゆえ client JS が実行されず Mode B coverage には現れない。decision 2 の scope 外だが、反証テスト（録画に含まれる行の欠落0）を満たすため可視化時刻付きで明示する。

| ファイル | 行 | 証拠 | 録画時刻(REC) | ソース |
|---|---|---|---|---|
| `src/app/layout.tsx` | 50 | V | 00:00.03 | `<html` |
| `src/app/layout.tsx` | 59 | V | 00:00.03 | `<body className={cn('mx-auto min-h-screen font-sans antialia` |
| `src/app/(main)/layout.tsx` | 20 | V | 00:14.55 | `<SidebarInset>{children}</SidebarInset>` |
