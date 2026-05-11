# チャットでかんたん操作 Webアプリテンプレート

目が悪い人、デジタル操作が苦手な人でも迷いにくいように、チャットボット風のUIにした静的HTMLテンプレートです。

## 改善内容

- 青いボタンを押すと、実際に次の会話ステップへ進むように修正
- オペレーターの案内をチャットボット風の吹き出しUIに変更
- 操作対象を画面下部の青いボタンに統一
- 本文を大きく、入力欄とボタンも大きく表示
- 「まだ確定ではありません」「空欄でも進めます」など、不安を減らす文言を追加
- 文字をさらに大きくするボタンを追加
- GitHub Pagesでそのまま公開可能

## ファイル構成

```text
friendly_chatbot_webapp/
├─ index.html
├─ style.css
├─ script.js
└─ README.md
```

## GitHub Pagesで公開する手順

1. GitHubの対象リポジトリを開きます。
2. このフォルダ内の `index.html`, `style.css`, `script.js`, `README.md` をリポジトリ直下にアップロードします。
3. `Settings` を開きます。
4. 左メニューの `Pages` を開きます。
5. `Build and deployment` で `Deploy from a branch` を選びます。
6. Branch を `main`、フォルダを `/root` にします。
7. `Save` を押します。
8. 表示されたURLにアクセスします。

## 主なカスタマイズ箇所

### タイトル

`index.html` の以下を書き換えます。

```html
<h1 id="pageTitle">チャットでかんたん操作</h1>
```

### チャットの言葉

`script.js` の `addMessage("bot", "...")` の文章を書き換えます。

### 選択肢

`script.js` の `purposeLabels` と `renderOperationPanel()` 内の選択肢ボタンを書き換えます。

### 色

`style.css` の `:root` 内を書き換えます。

```css
--primary: #1d4ed8;
--primary-dark: #143fba;
--primary-soft: #e8f0ff;
```

## 注意

このテンプレートはHTML/CSS/JavaScriptだけで動く静的Webアプリです。
サーバー保存、ログイン、データベース連携などは含みません。
