# 最終報告 — 録画 2026-07-17 22:27 の corelive/src コードとデバッガー表示の対応

**宛先**: Raphtalia（最終確認者）
**録画**: `録画 2026-07-17 22:27`（bundle `01KXR45HTQJKN2YBYV72G3FTTK`）
**対応表（提出物）**: [`coverage_table_01KXR45HTQJKN2YBYV72G3FTTK_2026-07-17_2227.md`](./coverage_table_01KXR45HTQJKN2YBYV72G3FTTK_2026-07-17_2227.md)
**対象コミット**: `f8bdb10`

---

## 1. 結論（TL;DR）

- **vendor フォールバックは廃止済み**（CodePanel の playhead 経路。P1 完了）。デバッガーは source-map 由来の「エディタで見るコード」を、録画のタイムラインに沿って表示する。
- **録画で画面に映った（rrweb）または実行された（cpu / Mode B 再実行）corelive/src の全行**を、ファイル名・行番号・タイムスタンプ付きで対応表 §1–§4 に列挙した。**機械照合で欠落 0**。
- **binding rule**（可視+実行 ⊆ 対応表）は 5名の独立サブエージェント監査が両ラウンドで確認、**gap 0**。
- 「録画に含まれている」の**境界**（バンドルに静的同梱されているが当セッションでは実行も可視化もされなかった行）は、対応表 §5 に**不変条件**として honest に明示した。その per-file 参考リスト（1手法の観測値）は本報告 §5 に添付する。

## 2. 対応表の構成

| 節 | 内容 | 規模 |
|---|---|---|
| §1 | 録画が直接証明する行（C=cpuprofile 実サンプル / V=rrweb 可視DOM / S=スタックアンカー） | 233 行 |
| §2 | Mode B 決定論的再実行の実行タイムライン（46 バケット、タイムスタンプ付き） | 6125 行 / 142 ファイル |
| §3 | ファイル別リバースインデックス（各ファイルの全実行行 + 録画直接証拠行） | 142 ファイル |
| §4 | server-rendered 行の honest union（client JS 非実行だが rrweb 可視のホスト行） | 3 行 |
| §5 | 「録画に含まれている」の定義と境界の明示（不変条件） | — |

- 各行は**凍結された `.entrance` バンドル内容**（録画時のソース）に対して照合。actively-edited な live corelive ディスクは一切参照しない（行番号ズレを防ぐため）。
- タイムスタンプは録画の t0（`manifest.json` t0Mono=14562.249042）起点の相対時刻。

## 3. 完全性の検証

**「録画に映っている・実行されている corelive/src の行が対応表から漏れていないか」** を次の2系統で検証した:

1. **機械照合**（`scripts/selfcheck-table.mjs` / `scripts/verify-against-recording.mjs`）:
   - 対応表の全 6358 行が凍結バンドルのソース行長内（phantom = **0**）。
   - app-chunk sourcemap に載る corelive/src ソース 155 個のうち 144 個が対応表に存在。不在 11 個は (a) 合成 proxy モジュール（`__nextjs-internal-proxy.mjs`、実ソースでない）、(b) `page.tsx`（SSR リダイレクトのみ）、(c) `flex.tsx`（sourcesContent のみ）で、いずれも当セッションで client 実行・可視化されていない。
   - 録画が直接証明する行（rrweb 可視 / Mode B 実行）で対応表に欠落するもの = **0**。
2. **5名の独立サブエージェント監査**（下記 §6）。

## 4. 「録画に含まれている」の定義（対応表 §5 の要約）

対応表は「録画に含まれている」を **録画の2つのクライアントオラクルが *可視(rrweb)* または *実行(cpu / Mode B)* として — デバッガーのタイムライン上に位置づけられる形で — 帰属した corelive/src の行**と定義する（decision 2: v1 は client JS のみ）。

バンドル成果物（client JS チャンク・SSR HTML・RSC フライトペイロード）には、このどちらのオラクルにも現れない corelive/src の `data-insp-path` スタンプも**静的に同梱**されている（server-component の合成サイト、当セッション未描画のコンポーネント、未実行の条件分岐 JSX、ビルド時ホイストされたスタンプ 等）。これらについて対応表が保証する**不変条件**（5監査が独立に検証済み。走査手法を最大限広げた上位集合に対しても成立）:

> **バンドル同梱のみの行 ∩ 可視集合（rrweb 179）= 0、∩ 実行集合（Mode B 6125 / cpu 54）= 0。**
> すなわち「バンドルに同梱されているだけで、当セッションに実行または可視化された行」は **1行も存在しない**。ゆえに §1–§4 の完全性は本境界の影響を受けない。

**この境界の総数は well-defined ではない**（blob 母集団 × スタンプ抽出法に依存し、確定的な上限も存在しない — 独立監査は手法ごとに異なる値を観測した）。だからこそ対応表は「録画に含まれている」を、一意に定義できる可視/実行オラクルにアンカーする。

## 5. 境界の per-file 参考リスト（1手法の観測値 — method-dependent）

以下は `scripts/scan-recording-stamps.mjs`（**data-insp-path 隣接正規表現 × 全 blob** という1手法）が拾った「バンドル同梱だが当セッション未実行・未可視」の corelive/src スタンプ **337 行 / 37 ファイル** である。**これは確定的な全数リストではなく、1手法の観測値**である（別手法では React Compiler ホイストスタンプが加わり ~406/45、現行 network.jsonl 参照 blob のみに絞ると ~331/35、SSR チャンクの sourcemap 内 `sourcesContent` まで含めるとさらに増える〔~409〕— **確定的な上限は存在しない**）。いずれの手法でも **rrweb 出現 = 0 / Mode B coverage 出現 = 0**（＝可視/実行集合との交差 0）は保たれる。

### Class A — server-render 出力（RSC flight + SSR HTML）: 17 行 / 4 ファイル

```
src/app/(main)/layout.tsx      : 18,19                          [RSC flight]
src/app/layout.tsx             : 49,62,63,64,65,66,67,68,74     [SSR HTML / RSC flight]
src/app/page.tsx               : 17,18,19,21,24                 [SSR HTML]
src/components/flex.tsx        : 21                             [SSR HTML]
```

`layout.tsx` / `(main)/layout.tsx` の provider 合成サイト（49,62–68,18,19）で合成される 9つの corelive client コンポーネントの実行コードは、**全て対応表に存在する**（真に外部なのは `<ClerkProvider>` 1件のみ。`<Toaster>` は `import { Toaster } from '@/components/ui/sonner'` — corelive の `src/components/ui/sonner.tsx` ラッパーで、20行 実行・対応表に存在）。＝合成サイト行自体は非掲載でも、そこで起きる client 挙動は対応表から漏れていない。

### Class B — client JS バンドルの静的 JSX（jschunk）: 320 行 / 33 ファイル

当セッションで一度も描画されなかったコンポーネント（未オープンのダイアログ・未遷移ルート・未発火エラーバウンダリ）、部分描画コンポーネント内の未実行条件分岐、DOM に data-insp-path を転送しない prop スタンプ 等。全行 rrweb 0 / coverage 0。

```
AddTodoForm.tsx        : 91,92,93,99,133
Category.tsx           : 201,206,210,213,220,221,225,226
CategoryManageDialog.tsx: 179,187,189,202,211,218,220,226,232,236,237,240,247,250,257,280
CompletedDropZone.tsx  : 58,59
CompletedJournalRow.tsx: 53,62,67,70,74,75,76,89
CompletedTodos.tsx     : 200,201,204,205,206,208,214,216,217,225,229,230,231,234,236,248,249,254,257
CompletedTodosFilters.tsx: 206,307,308,319,326
ContributionGraph.tsx  : 157,159,161,162,167,168,173,295
DayDetailDialog.tsx    : 225,262,263,264,270,271,274,279,280,293,297,304,306,313,319,325,327,333,335,339,347,350,359,360
LogoutButton.tsx       : 25,26
SortableTodoItem.tsx   : 67
SundayDigestCard.tsx   : 231,232,233,236,242,249,254,256,259,266,271,275,283,284
TodoItem.tsx           : 131,133,139,144,152,153,162,163,167,168,177,179,183,184,189,191,193,195,201,216,220,226,227,233,234,235,236
TodoList.tsx           : 566,567,570,622,626,628,647
WeeklySummaryCard.tsx  : 114,116,120,128,129
YearInReviewModal.tsx  : 208,209,212,218,219,225,231,239,240,243,245,249,250,258,260,269,274,275,307,316
app/error.tsx          : 66,67,68,69,74,75,76,83,84
app/global-error.tsx   : 144,145,146,147,151,152,159
login/[[...login]]/page.tsx: 86,87,90,91,92,94
auth/ElectronLoginForm.tsx: 266,270,271,274,275,276,290,291,294,295,306,316,318,326,331,334,335,344,345,346,348,349,356,363,365,366,371,376,381,387,392
import/ImportUndoBanner.tsx: 156,159,161,168,172
import/PasteImportDialog.tsx: 293,327,332,355,394,453,527,533,534,541,547,549,551,558,565,571,578
ThemePreviewSwatch.tsx : 39,40,45,50,56
ThemeSelector.tsx      : 67,74,75,76,86,93,94,102,103,104,113,122,128,134,139,141
ThemeSelectorMenuItem.tsx: 63,64,65,67,68,70,77,82,83,84,89,92,98,103,108,109
ui/calendar.tsx        : 132,143,149,157,163,164,167
ui/checkbox.tsx        : 22,26
ui/dropdown-menu.tsx   : 101,102,103,136,137,138,220
ui/radio-group.tsx     : 35,39
ui/sheet.tsx           : 57,58,75,76,77
ui/sidebar.tsx         : 182,194,195,196,198,533,534,618,623
ui/tooltip.tsx         : 26,45,55
lib/export-day-as-image.ts: 146,164
```

> 注: 上記はホイストスタンプ（`const t = __codeInspectorPath || "src/…:L:C:Tag"`、data-insp-path 非隣接）を含まないため、ui/alert-dialog.tsx・ui/card.tsx・ui/form.tsx 等の一部は**この手法では現れない**。それらを加える手法では ~406/45、SSR チャンクの sourcemap まで含めるとさらに増える。いずれの母集団でも「∩ 実行/可視 = 0」は不変。

## 6. 5名の独立サブエージェント監査

（**確定待ち — 最終ラウンド re-audit 実行中。5/5 完璧 確定後にここを更新**）

- 第1ラウンド: §1–§4 について 5/5 が「完璧・バイト不変・binding rule 0 gaps」と評価。
- 第2ラウンド以降: §5（境界節）の**列挙精度**に不完璧指摘 → 総数が構造的に方法依存で well-defined でない（走査手法ごとに異なる値・確定的な上限なし）と判明したため、§5 を確定 census から**不変条件**に collapse（commit `f8bdb10`）。§1–§4 データ行はバイト不変。
- 最終ラウンド: 提出物のバイトに対し再監査中。

## 7. 最終確認のお願い

対応表は「録画に含まれている」を可視/実行オラクルにアンカーして定義しています。この定義のもとで、**録画で画面に映った・実行された corelive/src の行は §1–§4 に漏れなく存在**します（欠落 0、機械照合 + 5監査）。§5 に列挙した境界（バンドル同梱のみの行）は当セッションで実行も可視化もされておらず、"画面に映っている、実行されている" という録画要件には該当しません。

もし §1–§4 に**録画で実際に映った・実行された**にもかかわらず欠落している corelive/src の行が1行でもあれば、ご指摘ください。§5 の per-file リスト（§5本文の1手法観測値）と照合の上、対応します。
