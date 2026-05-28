# Verovio Web Benchmark 検証手順

> **English version**: [verification.md](./verification.md)

---

## 1. 前提条件

| ツール  | バージョン | 確認コマンド |
| ------- | ---------- | ------------ |
| Node.js | >= 18.0.0  | `node -v`    |
| npm     | >= 9.0.0   | `npm -v`     |
| Chrome  | 最新       | Lighthouse / DevTools に必要 |

### ディレクトリ構成

```
parent/
├── verovio/                      # メインワークツリー（develop）
├── verovio-split/                # feature/split-wasm-module
├── verovio-light/                # feature/light-wasm-build
├── verovio-optimize/             # feature/web-optimize（全4バリアント対応）
├── verovio-current -> verovio    # シンボリックリンク（切替用）
└── verovio-web-benchmark/        # 本リポジトリ
```

---

## 2. Verovio ワークツリーのセットアップ

### 2.1 初期セットアップ（初回のみ）

```bash
cd ../verovio
git worktree add ../verovio-split feature/split-wasm-module
git worktree add ../verovio-light feature/light-wasm-build
git worktree add ../verovio-optimize feature/web-optimize
ln -s verovio ../verovio-current
```

### 2.2 WASM ビルド（ワークツリーごとに1回）

```bash
cd ../verovio-optimize/emscripten
./buildNpmPackage
```

### 2.3 ワークツリーの切替

```bash
ln -sfn verovio-optimize ../verovio-current
cd verovio-web-benchmark
npm install
```

### 2.4 モジュールサイズの確認

```bash
cd ../verovio-current/emscripten
setopt null_glob 2>/dev/null
for f in npm/dist/verovio-module*.mjs npm/dist/*.wasm; do
  [ -f "$f" ] || continue
  raw=$(wc -c < "$f")
  gz=$(gzip -c "$f" | wc -c)
  printf "%-50s %10s %10s\n" "$f" "$raw" "$gz"
done
```

---

## 3. ビルドと計測

### 3.1 バリアント指定ビルド

環境変数 `VARIANT` で WASM ロード方式を指定する:

```bash
VARIANT=inline-wasm npm run build   # インライン WASM（全フォント）
VARIANT=split-wasm  npm run build   # 分離 .wasm（全フォント）
VARIANT=light-wasm  npm run build   # インライン WASM（Leipzig のみ）
VARIANT=light-split npm run build   # 分離 .wasm（Leipzig のみ）
```

省略時は `inline-wasm` がデフォルト。

### 3.2 動作確認

```bash
npm run preview
```

ブラウザで `http://localhost:4173/` を開き、楽譜が表示されることを確認する。

### 3.3 Lighthouse による計測

1. Chrome で preview ページを開く
2. DevTools > **Lighthouse** タブ
3. Categories: **Performance** のみ選択
4. Device: **Mobile** または **Desktop**
5. 「Analyze page load」を実行

各バリアントでビルド → preview → Lighthouse を繰り返して比較する。

### 3.4 Performance タブでの詳細分析

DevTools > **Performance** タブでページロードを録画すると、以下のカスタムマークが表示される:

| マーク | 意味 |
| --- | --- |
| `verovio:fetch` | MEI ファイル取得 |
| `verovio:init` | WASM モジュール初期化（split ではネットワーク fetch 込み） |
| `verovio:render` | MEI パース + SVG 生成 |
| `verovio:total` | fetch 開始から DOM 描画完了まで |

---

## 4. Web Vitals との対応

| 最適化 | 影響する Web Vital | 理由 |
| --- | --- | --- |
| split（分離 .wasm） | FCP, TBT | JS が小さいため早く描画可能。ストリーミングコンパイルでメインスレッド非ブロック |
| light（Leipzig のみ） | LCP, TBT | 転送サイズ削減でダウンロード高速化。コンパイル対象が小さい |
| split + light | FCP, LCP, TBT | 上記の複合効果 |

---

## 5. トラブルシューティング

### zsh でモジュールサイズ確認コマンドがエラーになる

**症状**: `npm/dist/*.wasm` にマッチするファイルがない場合、zsh がグロブエラーで中断する

**対処**: コマンド先頭に `setopt null_glob 2>/dev/null` を追加する（セクション 2.4 のコマンドには適用済み）

### light ビルドで "Failed to load font and glyph bounding boxes"

**症状**: light-wasm / light-split で `loadData` が失敗し、楽譜がレンダリングされない

**原因**: verovio の `InitFonts()` が Bravura を先にロードしてグリフ名テーブルを構築する設計だが、light ビルドでは Bravura のフォントデータが除外されている。さらに `Resources::Ok()` が `m_loadedFonts.size() > 1`（2フォント以上）を要求する

**対処**: verovio 側の C++ を修正する（`resources.cpp` と `resources.h`）。詳細は verovio-optimize ブランチのコミットを参照

### Lighthouse で light-split の LCP が inline より遅い

**症状**: 転送サイズが小さいはずの light-split の LCP が inline-wasm より悪化する

**原因**: Vite の preview サーバーがデフォルトで `.wasm` ファイルを gzip 圧縮せずに配信する。`.js` は圧縮されるため、inline-wasm（gzip 2.3MB）の方が light-split の .wasm（raw 4.76MB）より転送サイズが小さくなる

**対処**: `vite.config.ts` に `compression` ミドルウェアを追加する（本リポジトリでは設定済み）。本番環境では CDN/リバースプロキシが圧縮を行うため、この問題は発生しない
