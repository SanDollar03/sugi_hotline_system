const chatMessages = document.getElementById("chatMessages");
const operationPanel = document.getElementById("operationPanel");
const toggleTextSizeButton = document.getElementById("toggleTextSizeButton");

const state = {
  step: "start",
  name: "",
  purpose: "",
  memo: "",
  largeText: false,
  history: []
};

const purposeLabels = {
  howto: "操作方法を知りたい",
  apply: "申し込み・手続きを進めたい",
  trouble: "困っているので相談したい"
};

function addMessage(role, text) {
  state.history.push({ role, text });
}

function clearMessages() {
  state.history = [];
}

function renderMessages() {
  chatMessages.innerHTML = "";

  state.history.forEach((message) => {
    const row = document.createElement("div");
    row.className = `chat-message ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = `message-avatar ${message.role}`;
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = message.role === "bot" ? "案" : "私";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatMessages.appendChild(row);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function buttonHtml(action, title, note, className = "primary-action", extraAttributes = "") {
  return `
    <button class="${className}" type="button" data-action="${action}" ${extraAttributes}>
      <span>
        <span class="action-main-text">${title}</span>
        <span class="action-sub-text">${note}</span>
      </span>
      <span class="action-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function renderOperationPanel() {
  if (state.step === "start") {
    operationPanel.innerHTML = `
      <div class="action-frame">
        <span class="action-title">次に押す場所はこちらです</span>
        <p class="action-help">下の青いボタンを押すと、チャット案内が始まります。</p>
        ${buttonHtml("start", "案内を始める", "ここから順番に進めます")}
      </div>
    `;
    return;
  }

  if (state.step === "askName") {
    operationPanel.innerHTML = `
      <div class="action-frame">
        <span class="action-title">お名前を入力してください</span>
        <p class="action-help">分からない場合や入力したくない場合は、空欄のまま進めます。</p>
        <div class="form-field">
          <label for="nameInput">お名前</label>
          <input id="nameInput" type="text" autocomplete="name" placeholder="例：山田 太郎" value="${escapeAttribute(state.name)}" />
          <p class="help-text">あとから変更できます。</p>
        </div>
        ${buttonHtml("submitName", "名前を確認して次へ進む", "空欄でも次に進めます")}
        <button class="secondary-action" type="button" data-action="restart">はじめからやり直す</button>
      </div>
    `;
    focusInput("nameInput");
    return;
  }

  if (state.step === "askPurpose") {
    operationPanel.innerHTML = `
      <div class="action-frame">
        <span class="action-title">今したいことを選んでください</span>
        <p class="action-help">近いものを一つ選べば大丈夫です。あとで変更できます。</p>
        ${buttonHtml("selectPurpose", "操作方法を知りたい", "使い方の案内を受けたい", "choice-action", 'data-purpose="howto"')}
        ${buttonHtml("selectPurpose", "申し込み・手続きを進めたい", "入力や確認を進めたい", "choice-action", 'data-purpose="apply"')}
        ${buttonHtml("selectPurpose", "困っているので相談したい", "うまくいかない内容を伝えたい", "choice-action", 'data-purpose="trouble"')}
        <button class="secondary-action" type="button" data-action="backToName">ひとつ前に戻る</button>
        <button class="secondary-action" type="button" data-action="restart">はじめからやり直す</button>
      </div>
    `;
    return;
  }

  if (state.step === "askMemo") {
    operationPanel.innerHTML = `
      <div class="action-frame">
        <span class="action-title">必要なことを少しだけ教えてください</span>
        <p class="action-help">短い文章で構いません。分からない場合は空欄でも進めます。</p>
        <div class="form-field">
          <label for="memoInput">ご相談内容</label>
          <textarea id="memoInput" placeholder="例：ログイン方法が分かりません">${escapeHtml(state.memo)}</textarea>
          <p class="help-text">詳しく書かなくても大丈夫です。</p>
        </div>
        ${buttonHtml("submitMemo", "入力内容を確認する", "まだ確定されません。次の画面で確認します")}
        <button class="secondary-action" type="button" data-action="backToPurpose">ひとつ前に戻る</button>
        <button class="secondary-action" type="button" data-action="restart">はじめからやり直す</button>
      </div>
    `;
    focusInput("memoInput");
    return;
  }

  if (state.step === "confirm") {
    const displayName = state.name || "未入力";
    const displayPurpose = purposeLabels[state.purpose] || "未選択";
    const displayMemo = state.memo || "未入力";

    operationPanel.innerHTML = `
      <div class="action-frame">
        <span class="action-title">内容を確認してください</span>
        <p class="action-help">この内容でよければ、青いボタンを押してください。</p>
        <dl class="summary-card">
          <div class="summary-row">
            <dt class="summary-label">お名前</dt>
            <dd>${escapeHtml(displayName)}</dd>
          </div>
          <div class="summary-row">
            <dt class="summary-label">目的</dt>
            <dd>${escapeHtml(displayPurpose)}</dd>
          </div>
          <div class="summary-row">
            <dt class="summary-label">内容</dt>
            <dd>${escapeHtml(displayMemo)}</dd>
          </div>
        </dl>
        ${buttonHtml("complete", "この内容で完了する", "確認してから完了します")}
        <button class="secondary-action" type="button" data-action="backToMemo">内容を書き直す</button>
        <button class="secondary-action" type="button" data-action="restart">はじめからやり直す</button>
      </div>
    `;
    return;
  }

  if (state.step === "complete") {
    operationPanel.innerHTML = `
      <div class="action-frame">
        <div class="success-box">完了しました。必要な操作はここまでです。</div>
        ${buttonHtml("restart", "もう一度はじめから行う", "最初の案内に戻ります")}
      </div>
    `;
  }
}

function render() {
  renderMessages();
  renderOperationPanel();
}

function startConversation() {
  clearMessages();
  addMessage("bot", "こんにちは。私が一つずつご案内します。まずは青いボタンを押して始めましょう。");
  addMessage("bot", "途中で分からなくなっても大丈夫です。いつでも、はじめからやり直せます。");
  state.step = "start";
  render();
}

function handleAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "start") {
    addMessage("user", "案内を始める");
    addMessage("bot", "ありがとうございます。まずはお名前を教えてください。空欄のままでも進めます。");
    state.step = "askName";
    render();
    return;
  }

  if (action === "submitName") {
    const input = document.getElementById("nameInput");
    state.name = input ? input.value.trim() : state.name;
    addMessage("user", state.name ? `${state.name}です` : "名前はあとで入力します");
    addMessage("bot", "承知しました。次に、今日したいことを選んでください。近いものを一つ選べば大丈夫です。");
    state.step = "askPurpose";
    render();
    return;
  }

  if (action === "selectPurpose") {
    const purpose = button.dataset.purpose || "";
    state.purpose = purpose;
    addMessage("user", purposeLabels[purpose] || "目的を選びました");
    addMessage("bot", "ありがとうございます。必要なことを少しだけ教えてください。短い文章でも、空欄でも進めます。");
    state.step = "askMemo";
    render();
    return;
  }

  if (action === "submitMemo") {
    const textarea = document.getElementById("memoInput");
    state.memo = textarea ? textarea.value.trim() : state.memo;
    addMessage("user", state.memo ? state.memo : "相談内容はあとで入力します");
    addMessage("bot", "入力ありがとうございます。最後に内容を確認しましょう。まだ確定ではありません。");
    state.step = "confirm";
    render();
    return;
  }

  if (action === "complete") {
    addMessage("user", "この内容で完了する");
    addMessage("bot", "完了しました。お疲れさまでした。必要な操作はここまでです。");
    state.step = "complete";
    render();
    return;
  }

  if (action === "backToName") {
    addMessage("user", "ひとつ前に戻る");
    addMessage("bot", "お名前の入力に戻りました。変更しなくても、そのまま次に進めます。");
    state.step = "askName";
    render();
    return;
  }

  if (action === "backToPurpose") {
    addMessage("user", "ひとつ前に戻る");
    addMessage("bot", "目的の選択に戻りました。近いものを一つ選んでください。");
    state.step = "askPurpose";
    render();
    return;
  }

  if (action === "backToMemo") {
    addMessage("user", "内容を書き直す");
    addMessage("bot", "ご相談内容の入力に戻りました。短く書くだけで大丈夫です。");
    state.step = "askMemo";
    render();
    return;
  }

  if (action === "restart") {
    state.name = "";
    state.purpose = "";
    state.memo = "";
    startConversation();
  }
}

function toggleTextSize() {
  state.largeText = !state.largeText;
  document.body.classList.toggle("large-text", state.largeText);
  toggleTextSizeButton.textContent = state.largeText ? "標準の文字サイズに戻す" : "文字をさらに大きくする";

  addMessage(
    "bot",
    state.largeText
      ? "文字をさらに大きくしました。見やすくなったか確認してください。"
      : "文字の大きさを標準に戻しました。"
  );
  renderMessages();
}

function focusInput(id) {
  window.setTimeout(() => {
    const input = document.getElementById(id);
    if (input) input.focus();
  }, 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

operationPanel.addEventListener("click", handleAction);
toggleTextSizeButton.addEventListener("click", toggleTextSize);

startConversation();
