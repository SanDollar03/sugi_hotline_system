const mainActionButton = document.getElementById("mainActionButton");
const resetButton = document.getElementById("resetButton");
const statusMessage = document.getElementById("statusMessage");
const fontSizeButtons = document.querySelectorAll("[data-font-size]");
const nameInput = document.getElementById("name");
const memoInput = document.getElementById("memo");

function setStatus(type, text) {
  statusMessage.className = `message ${type}`;
  statusMessage.textContent = text;
}

mainActionButton.addEventListener("click", () => {
  const name = nameInput.value.trim();

  if (name) {
    setStatus("success", `${name}さん、ありがとうございます。確認画面へ進む準備ができました。まだ確定ではありませんので、安心してお進みください。`);
  } else {
    setStatus("success", "確認画面へ進む準備ができました。お名前が空欄でも、このまま確認できます。まだ確定ではありません。");
  }
});

resetButton.addEventListener("click", () => {
  nameInput.value = "";
  memoInput.value = "";
  document.body.classList.remove("large-text");
  setStatus("info", "最初の状態に戻しました。準備ができたら、青いボタンを押してください。");
  nameInput.focus();
});

fontSizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const size = button.dataset.fontSize;

    if (size === "large") {
      document.body.classList.add("large-text");
      setStatus("info", "文字をさらに大きくしました。見やすくなったか確認してください。操作は青いボタンから進められます。");
    } else {
      document.body.classList.remove("large-text");
      setStatus("info", "文字の大きさを標準に戻しました。準備ができたら、青いボタンを押してください。");
    }
  });
});
