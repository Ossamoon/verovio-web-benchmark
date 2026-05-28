# Verovio Web Benchmark 検証手順

> **English version**: [verification.md](./verification.md)

本ドキュメントでは、ベンチマークサイトの動作確認、計測、Vite依存解決の検証手順を網羅的に記述する。

---

## 1. 前提条件

### 必要なツール

| ツール | バージョン | 確認コマンド |
|---|---|---|
| Node.js | >= 18.0.0 | `node -v` |
| npm | >= 9.0.0 | `npm -v` |
| brotli (オプション) | 任意 | `brotli --version` |
| Chrome | 最新 | DevTools 計測に必要 |

### ディレクトリ構成

本プロジェクトでは **git worktree** を使い、各 Verovio ブランチを別ディレクトリに展開する。ビルド成果物がブランチ間で干渉せず、計測切替時の再ビルドが不要になる。**シンボリックリンク**（`verovio-current`）により、`package.json` を編集せずに切替可能。

```
parent/
├── verovio/                      # メインワークツリー（develop、ビルド済み）
├── verovio-split/                # ワークツリー: feature/split-wasm-module
├── verovio-light/                # ワークツリー: feature/light-wasm-build
├── verovio-optimize/             # ワークツリー: feature/web-optimize
├── verovio-current -> verovio    # シンボリックリンク（切替用）
└── verovio-web-benchmark/        # 本リポジトリ
    └── package.json              # "verovio": "file:../verovio-current/emscripten/npm"
```

> **新規参加者向け**: worktree を使わない場合でも、シンボリックリンクさえ作れば動作する: `ln -s verovio verovio-current`

---

## 2. Verovio ワークツリーのセットアップと WASM ビルド

各 Verovio ブランチは git worktree で個別のディレクトリに展開する。ビルド成果物はワークツリーごとに独立しているため、一度ビルドすればブランチ切替時のクリーンアップや再ビルドは不要。

### 2.1 検証対象ブランチとワークツリー

| ワークツリー | Verovio ブランチ | 利用可能バリアント | 検証内容 |
|---|---|---|---|
| `verovio/` | `develop`（ベースライン） | inline-wasm | 現在のバンドルサイズとロード時間を記録 |
| `verovio-split/` | `feature/split-wasm-module` | inline-wasm, split-wasm | inline vs split のサイズ・ロード時間を比較 |
| `verovio-light/` | `feature/light-wasm-build` | inline-wasm, light-wasm | 全フォント vs Leipzig のみのサイズを比較 |
| `verovio-optimize/` | `feature/web-optimize` | 全4バリアント | 完全最適化された wasm-light-split ビルドを計測 |

### 2.2 ワークツリーの初期セットアップ

初回のみ実行。既にワークツリーが作成済みの場合はスキップ。

```bash
# メインの verovio リポジトリから実行
cd ../verovio
git worktree add ../verovio-split feature/split-wasm-module
git worktree add ../verovio-light feature/light-wasm-build
git worktree add ../verovio-optimize feature/web-optimize

# シンボリックリンクを作成（初期状態では develop を指す）
ln -s verovio ../verovio-current

# 確認
git worktree list
```

### 2.3 WASM ビルド（ワークツリーごと）

各ワークツリーで1回ずつ WASM をビルドする。一度ビルドすれば成果物は保持される。

```bash
# 例: split-wasm ワークツリーをビルド
cd ../verovio-split/emscripten
./buildNpmPackage

# ビルド成果物の確認
ls -la npm/dist/
```

ビルド成功時に存在するファイル（ブランチにより異なる）:

| ファイル | ブランチ | 説明 |
|---|---|---|
| `verovio-module.mjs` | 全ブランチ | インライン WASM（全フォント） |
| `verovio-module-split.mjs` + `*.wasm` | split-wasm 対応ブランチ | 分離 WASM（全フォント） |
| `verovio-module-light.mjs` | light 対応ブランチ | インライン WASM（Leipzig のみ） |
| `verovio-module-light-split.mjs` + `*.wasm` | web-optimize | 分離 WASM（Leipzig のみ） |
| `verovio.mjs` | 全ブランチ | ESM ツールキット |

### 2.4 ワークツリーの切替

シンボリックリンクの参照先を変更して再インストール:

```bash
# split-wasm ワークツリーに切替
ln -sfn verovio-split ../verovio-current
cd verovio-web-benchmark
npm install

# light ワークツリーに切替
ln -sfn verovio-light ../verovio-current
npm install

# develop に戻す
ln -sfn verovio ../verovio-current
npm install
```

### 2.5 verovio 側での事前サイズ確認

Vite バンドル前の生モジュールサイズを verovio 側で直接確認できる。ビルド直後に WASM モジュール自体の最適化効果を素早く把握したい場合に有用。

```bash
cd ../verovio-current/emscripten
for f in npm/dist/verovio-module*.mjs npm/dist/*.wasm; do
  [ -f "$f" ] || continue
  raw=$(wc -c < "$f")
  gz=$(gzip -c "$f" | wc -c)
  printf "%-50s %10s %10s\n" "$f" "$raw" "$gz"
done
```

**benchmark 側の計測（セクション5）との違い**:

| 計測場所 | 対象 | 意味 |
|---|---|---|
| verovio 側 (`npm/dist/`) | Emscripten/Rollup が出力した生モジュール | WASM ビルド自体の最適化効果を直接測定 |
| benchmark 側 (`dist/assets/`) | Vite がバンドルしたチャンク | エンドユーザーが実際にダウンロードするサイズ |

- verovio 側: VerovioToolkit 等の共有コードが各モジュールに含まれた状態のサイズ
- benchmark 側: Vite が shared chunk を分離し、React や main.ts のコードも別チャンクとなる

### 2.6 計測の一連の流れ（まとめ）

```bash
# 対象ワークツリーに切替（事前に1回ビルド済みであること）
ln -sfn verovio-split ../verovio-current

# 再インストール、ビルド、計測
cd verovio-web-benchmark
npm install
npm run build
npm run measure-sizes

# 結果を保存
cp results/sizes.json results/sizes-split.json
```

---

## 3. ベンチマーク環境の準備と開発サーバー確認

### 3.1 初期セットアップ

セクション2の WASM ビルドが完了していることを前提とする。

```bash
cd verovio-web-benchmark
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開く。

### 3.2 個別メソッドの実行

以下の4メソッドをそれぞれ選択して「Run Selected」ボタンを押す:

1. **inline-wasm** — `verovio/wasm`（インライン WASM、全フォント）
2. **split-wasm** — `verovio/wasm-split`（分離 .wasm、全フォント）
3. **light-wasm** — `verovio/wasm-light`（インライン WASM、Leipzig のみ）
4. **light-split** — `verovio/wasm-light-split`（分離 .wasm、Leipzig のみ）

各メソッドで確認する項目:

- [ ] 結果テーブルに行が追加される
- [ ] `initTimeMs` と `renderTimeMs` が正の数値で表示される
- [ ] `version` が Verovio のバージョン文字列（例: `6.3.0-alpha`）を示す
- [ ] `pageCount` が 1 以上
- [ ] SVG Output エリアに楽譜が表示される
- [ ] ブラウザコンソール（F12 → Console）にエラーがない

> **注意**: 現在の Verovio ブランチが対応していないバリアントを実行するとエラーになる。セクション 2.1 の表を参照し、対応するバリアントのみ実行すること。

### 3.3 「Run All」の確認

1. 「Clear Results」ボタンを押してリセット
2. 「Run All」ボタンを押す
3. 確認:
   - [ ] 4つのメソッドが順番に実行される（ステータス表示が切り替わる）
   - [ ] 結果テーブルに4行が表示される
   - [ ] 最速値が緑色のボールドでハイライトされる

---

## 4. プロダクションビルドの確認

### 4.1 ビルドの実行

```bash
npm run build
```

エラーなく完了することを確認。

### 4.2 チャンク構成の確認

```bash
ls -la dist/assets/
```

確認項目:
- [ ] 複数の `.js` ファイルが存在する（メインチャンク + 各ベンチマークのチャンク + 共有チャンク）
- [ ] split バリアント使用時、`.wasm` ファイルが存在する
- [ ] ファイルサイズが合理的（inline バリアントのチャンクは split バリアントより大きいはず）

### 4.3 プレビューサーバーでの動作確認

```bash
npm run preview
```

ブラウザで表示された URL を開き、セクション3と同じ確認を行う。特に:
- [ ] split-wasm が正常に動作する（`.wasm` ファイルのフェッチが成功する）
- [ ] light-split が正常に動作する
- [ ] ブラウザの Network タブで `.wasm` ファイルのレスポンスが 200 であること

---

## 5. ファイルサイズ計測

### 5.1 計測の実行

```bash
npm run measure-sizes
```

### 5.2 出力例

```
=== File Sizes ===

File                                          Raw         Gzip       Brotli
---------------------------------------------------------------------------------
inline-wasm-xxxxx.js                       8.5 MB     3.2 MB      2.8 MB
split-wasm-xxxxx.js                       45.2 KB    15.1 KB     12.8 KB
verovio-xxxxx.wasm                         8.4 MB     3.1 MB      2.7 MB
light-wasm-xxxxx.js                        4.2 MB     1.6 MB      1.4 MB
light-split-xxxxx.js                      22.1 KB     7.5 KB      6.3 KB
verovio-light-xxxxx.wasm                   4.1 MB     1.5 MB      1.3 MB
...

=== Estimated Download Times (gzip-based) ===

File                                    Slow 3G (400 Kbps)   Fast 3G (1.6 Mbps)      4G (10 Mbps)
...
```

### 5.3 結果の読み方

| 項目 | 説明 |
|---|---|
| Raw | 圧縮前のファイルサイズ |
| Gzip | gzip 圧縮後のサイズ（一般的なサーバー配信時） |
| Brotli | Brotli 圧縮後のサイズ（モダンな CDN 配信時） |
| ダウンロード時間 | gzip サイズをベースにした帯域幅別の推定時間 |

### 5.4 結果の保存と比較

計測結果は `results/sizes.json` に自動保存される。ブランチ間の比較には:

```bash
# develop ブランチの結果を保存
cp results/sizes.json results/sizes-develop.json

# feature ブランチに切り替えて再計測（セクション 2.5 の手順）
# ...

# 差分を確認
diff results/sizes-develop.json results/sizes.json
```

---

## 6. Vite 依存解決の全層検証

### 6.1 optimizeDeps の挙動確認

Vite の依存プリバンドルキャッシュに verovio が含まれていないことを確認する。

```bash
# dev サーバーを起動後
ls node_modules/.vite/deps/
```

確認項目:
- [ ] `verovio` に関連するファイルがプリバンドルキャッシュに**存在しない**
- [ ] `react` など他の依存はプリバンドルされている

`vite.config.ts` の設定が正しく効いている証拠:
```ts
optimizeDeps: {
  exclude: ['verovio'],
}
```

もし verovio がプリバンドルされている場合、WASM モジュールのロードが失敗するか、チャンク分離が正しく行われない可能性がある。

### 6.2 ビルドチャンク分析

ビルド後に生成されるチャンクが、各ベンチマークバリアントを正しく分離しているか確認する。

#### 6.2.1 ファイルサイズによる確認

```bash
ls -lhS dist/assets/*.js
```

期待される結果:
- **inline-wasm のチャンク**: 最大（WASM バイナリがインラインされている）
- **light-wasm のチャンク**: inline-wasm より小さい（Leipzig フォントのみ）
- **split-wasm / light-split のチャンク**: 非常に小さい（WASM ローダーのみ）
- **共有チャンク**: VerovioToolkit を含む小さなチャンク

#### 6.2.2 Vite マニフェスト解析

```bash
cat dist/.vite/manifest.json | python3 -m json.tool
```

マニフェストの各エントリが以下のように対応していることを確認:

| エントリ | 対応チャンク | 含まれるアセット |
|---|---|---|
| `src/benchmarks/inline-wasm.ts` | `assets/inline-wasm-*.js` | なし |
| `src/benchmarks/split-wasm.ts` | `assets/split-wasm-*.js` | `.wasm` ファイル |
| `src/benchmarks/light-wasm.ts` | `assets/light-wasm-*.js` | なし |
| `src/benchmarks/light-split.ts` | `assets/light-split-*.js` | `.wasm` ファイル |

### 6.3 ランタイムモジュール解決の確認

ブラウザの Network タブで、各ベンチマーク実行時に異なる JS チャンクがロードされることを確認する。

#### 手順

1. Chrome で `npm run preview` のページを開く
2. DevTools > Network タブを開く
3. フィルターを `JS` に設定
4. 「Clear Results」を押す
5. **inline-wasm** を選択して実行
   - [ ] `inline-wasm-*.js` チャンクがロードされる
   - [ ] このチャンクのサイズが大きい（WASM インライン）
6. ページをリロード（キャッシュクリア: Cmd+Shift+R）
7. **split-wasm** を選択して実行
   - [ ] `split-wasm-*.js` チャンクがロードされる（小さい）
   - [ ] 別途 `.wasm` ファイルのリクエストが発生する
8. 同様に **light-wasm** と **light-split** でも確認

### 6.4 split WASM の .wasm ファイル配信確認

```bash
# preview サーバー起動中に別ターミナルで確認
curl -I http://localhost:4173/assets/[wasm-filename].wasm
```

確認項目:
- [ ] HTTP ステータスが `200 OK`
- [ ] `Content-Type` が `application/wasm` であること
- [ ] `Content-Length` が合理的なサイズであること

---

## 7. DevTools スロットリングによる手動計測

### 7.1 ネットワークスロットリングの設定

1. Chrome DevTools を開く（F12 または Cmd+Option+I）
2. **Network** タブを選択
3. **Throttling** ドロップダウンから以下を選択:
   - `Fast 3G`: ダウンロード 1.6 Mbps / アップロード 750 Kbps / レイテンシ 150ms
   - `Slow 3G`: ダウンロード 400 Kbps / アップロード 400 Kbps / レイテンシ 400ms

### 7.2 計測手順

各ベンチマークメソッドについて、以下を**3回**繰り返す:

1. スロットリングを設定
2. ハードリフレッシュ: `Cmd + Shift + R`（キャッシュを無効化してリロード）
3. ページロード完了を待つ
4. 目的のベンチマークメソッドを選択して実行
5. Network タブのウォーターフォールを確認・記録:
   - JS チャンクのフェッチ時間
   - `.wasm` ファイルのフェッチ時間（split バリアントのみ）
   - WASM コンパイル開始〜完了の時間
6. 結果テーブルの `initTimeMs` と `renderTimeMs` を記録

3回の計測結果から**メジアン**（中央値）を採用する。

### 7.3 ウォーターフォールの読み方

Network タブの各リクエストで注目するポイント:

| フェーズ | 説明 | 確認方法 |
|---|---|---|
| Stalled / Queueing | リクエストのキューイング | ウォーターフォールの灰色部分 |
| TTFB | 最初のバイト受信まで | ウォーターフォールの緑色部分 |
| Content Download | データ転送 | ウォーターフォールの青色部分 |

**inline vs split の比較ポイント**:
- **inline-wasm**: JS チャンク内に WASM がBase64エンコードで含まれるため、JS のダウンロードが大きい。ダウンロード完了後に WASM デコード・コンパイルが発生
- **split-wasm**: JS ローダーは小さくすぐダウンロード完了。その後 `.wasm` ファイルをフェッチし、**ストリーミングコンパイル**（`WebAssembly.instantiateStreaming`）が可能。ダウンロードとコンパイルが並行して進む

### 7.4 Performance タブでの初期化プロファイリング

より詳細な分析が必要な場合:

1. DevTools > **Performance** タブを開く
2. 録画ボタン（丸い赤ボタン）をクリック
3. ベンチマークメソッドを実行
4. 実行完了後に録画を停止
5. タイムラインで以下を確認:
   - `wasm-compile`: WASM コンパイル時間
   - `wasm-instantiate`: WASM インスタンス化時間
   - メインスレッドのブロッキング時間

---

## 8. トラブルシューティング

### verovio パッケージが解決できない

**症状**: `npm install` で `Could not resolve dependency` エラー

**原因**: シンボリックリンク先の `emscripten/npm/dist/` が未ビルド

**対処**:
```bash
# シンボリックリンクの参照先を確認
ls -la ../verovio-current

# そのワークツリーで WASM をビルド
cd ../verovio-current/emscripten
./buildNpmPackage
cd ../../verovio-web-benchmark
rm -rf node_modules
npm install
```

### シンボリックリンクが見つからない

**症状**: `npm install` で `ENOENT ../verovio-current/emscripten/npm` エラー

**原因**: `verovio-current` シンボリックリンクが存在しない

**対処**:
```bash
# シンボリックリンクを作成（対象ワークツリーを指定）
ln -s verovio ../verovio-current
```

### split WASM の .wasm ファイルが 404

**症状**: split-wasm 実行時に Network タブで `.wasm` ファイルが 404

**原因**: ビルド時に `.wasm` ファイルが `dist/assets/` にコピーされていない

**対処**:
1. `dist/assets/` に `.wasm` ファイルが存在するか確認
2. 存在しない場合、`vite.config.ts` の `assetsInclude` 設定を確認
3. 手動コピーで応急対処: `cp node_modules/verovio/dist/*.wasm dist/assets/`

### WASM 初期化がタイムアウトする

**症状**: ベンチマーク実行が完了しない、ブラウザがフリーズ

**原因**: WASM モジュールが大きすぎてコンパイルに時間がかかっている

**対処**:
1. スロットリングを解除して再試行
2. DevTools > Performance タブで WASM コンパイル時間を確認
3. light バリアントを先に試す（サイズが約半分）

### メモリ不足エラー（「Run All」時）

**症状**: `Out of memory` エラーまたはタブがクラッシュ

**原因**: 複数の WASM インスタンスが同時にメモリを占有

**対処**:
1. ブラウザタブを閉じて再度開く
2. 各メソッドを個別に実行する
3. `toolkit.destroy()` が正しく呼ばれているか確認（`src/benchmarks/*.ts`）

### Vite プリバンドルエラー

**症状**: dev サーバー起動時に `Pre-bundling failed` または verovio 関連の WASM エラー

**原因**: `optimizeDeps.exclude` に `verovio` が設定されていない

**対処**:
1. `vite.config.ts` を確認:
   ```ts
   optimizeDeps: {
     exclude: ['verovio'],
   }
   ```
2. Vite キャッシュをクリア:
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

### ワークツリーの管理

**一覧表示**:
```bash
cd ../verovio
git worktree list
```

**ワークツリーの削除**（不要になった場合）:
```bash
git worktree remove ../verovio-split
```

**ワークツリーの WASM 再ビルド**（新しい変更を取り込んだ後）:
```bash
cd ../verovio-split/emscripten
rm -rf npm/dist build CMakeFiles CMakeCache.txt
./buildNpmPackage
```
