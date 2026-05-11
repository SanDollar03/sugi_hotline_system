# ホットラインAIエージェント v3.1 チャットボットUI版

## 変更点

- 画面全体をチャットボットエリアに変更
- ユーザーが見る範囲を「会話履歴」と「回答入力エリア」に限定
- 大きな文字、大きな選択ボタン、明確な操作エリアを採用
- オペレーターの温かい言葉をチャット吹き出し形式で表示
- 仕様書の10ステップ、動的分岐、AI要約確認、修正フロー、バリデーションをReact単体で実装
- Slack通知・管理表転記はプロトタイプ用モックとして画面表示

## 対象ファイル

- `src/hotline_ai_agent_v3.jsx`
- ルートにも同じ `hotline_ai_agent_v3.jsx` を同梱しています。

## GitHub Pagesでそのまま公開する場合

このZIPの中身をGitHubリポジトリ直下へ置いてください。

最低限必要なファイルは以下です。

```text
index.html
standalone_hotline_ai_agent_v3.jsx
```

`index.html` は、GitHub Pagesで直接表示できるようにReactとBabelをCDNから読み込むプロトタイプ構成です。

## React / Viteで開発する場合

Vite構成で開発したい場合は、`index.vite.html` を `index.html` にリネームしてから使用してください。

```bash
npm install
npm run dev
```

ビルドする場合：

```bash
npm run build
```

## プロトタイプ上の注意

- Slack API、Google Sheets API、Claude APIは未接続です。
- 送信時は「通知済み」「管理表記入済み」のモック表示を行います。
- AI要約はルールベースの簡易処理です。
- 実運用ではAPI連携、認証、セッション管理、ログ保管が必要です。
