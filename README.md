# かんたん操作Webアプリ テンプレート

目が悪い人、デジタル操作が苦手な人にも分かりやすいように、以下を重視したHTMLテンプレートです。

- 大きな文字
- 大きなボタン
- 操作対象を青い枠で明確化
- 親切な案内スタッフ風の文言
- キーボード操作時の強いフォーカス表示
- スマートフォン対応

## ファイル構成

```text
friendly_webapp_template/
├─ index.html
├─ style.css
├─ script.js
└─ README.md
```

## GitHub Pagesで公開する手順

1. GitHubの自分のリポジトリに、この4ファイルをアップロードします。
2. リポジトリの `Settings` を開きます。
3. 左メニューの `Pages` を開きます。
4. `Build and deployment` で `Deploy from a branch` を選びます。
5. Branchを `main`、フォルダを `/root` にします。
6. `Save` を押します。
7. 表示されたURLにアクセスすると公開ページを確認できます。

## カスタマイズする場所

### 画面タイトル

`index.html` の以下を書き換えます。

```html
<h1>必要な操作を、順番にご案内します</h1>
```

### メインボタンの文言

`index.html` の以下を書き換えます。

```html
<span class="button-title">内容を確認して次へ進む</span>
<span class="button-note">まだ確定されません。次の画面で確認できます。</span>
```

### 色

`style.css` の `:root` 内にある色を変更します。

```css
--primary: #1d4ed8;
--primary-dark: #153eaa;
--primary-soft: #e8f0ff;
```

## 設計メモ

このテンプレートでは、ユーザーが迷わないように「次に押す場所」を青い枠で囲んでいます。
押せる場所は大きく、押した後に何が起きるかをボタン内に書いています。
