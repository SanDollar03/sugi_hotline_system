(function () {
  "use strict";

  const CATEGORIES = {
    DISPENSING: "Ⅰ. 調剤ミス",
    PRIVACY: "Ⅱ. 個人情報漏洩",
    CONTROLLED_LOSS: "Ⅲ. 管理薬剤の紛失",
    OTHER: "Ⅳ. その他トラブル"
  };

  const CATEGORY_OPTIONS = [
    CATEGORIES.DISPENSING,
    CATEGORIES.PRIVACY,
    CATEGORIES.CONTROLLED_LOSS,
    CATEGORIES.OTHER
  ];

  const MISTAKE_TYPES = [
    "疑義照会漏れ",
    "規格間違い",
    "数量間違い／ピッキング数間違い",
    "用量間違い",
    "用法間違い",
    "渡し忘れ",
    "分包ミス",
    "異薬異物混入",
    "入力間違い／漏れ",
    "薬剤名称／変更間違い",
    "剤形間違い",
    "別患者への投薬",
    "カレンダーセット間違い",
    "その他"
  ];

  const HEADQUARTER_OPTIONS = ["医療営業本部", "阪神調剤営業本部"];
  const PATIENT_REACTIONS = ["お怒り", "体調不良", "不安", "問題なし", "未接触", "不明"];
  const YES_NO = ["あり", "なし"];
  const YES_NO_UNKNOWN = ["あり", "なし", "不明"];

  const QUESTION_LABELS = {
    category: "分類",
    mistake_type: "ミスの種類",
    headquarter: "本部区分",
    store_code: "店番",
    store_name: "店舗名",
    medical_institution: "医療機関名",
    dose_date: "投薬日",
    discovery_date: "発覚日",
    patient_type: "新患/既患",
    patient_gender: "患者性別",
    patient_age: "患者年齢",
    true_false_info: "正誤情報",
    input_error: "入力ミスの有無",
    taken: "服用の有無",
    taken_count: "服用回数",
    health: "健康被害",
    health_detail: "症状詳細",
    finder: "発見者",
    discovery_detail: "発覚の経緯",
    patient_reaction: "患者様・関係者の状態",
    medical_report: "医療機関への報告",
    patient_action_detail: "対応状況（患者）",
    external_action_detail: "対応状況（外部）",
    occurrence_date: "発生日",
    leaked_document: "漏洩した書類名・データ",
    privacy_who_to_whom: "誰の何を誰に渡したか",
    recovery_action: "対応状況（回収対応）",
    leak_destination_action: "対応状況（漏洩先への対応）",
    secondary_complaint: "2次クレームへの発展",
    controlled_class: "紛失医薬品の分類",
    controlled_medicine_name: "医薬品名",
    controlled_lost_qty: "紛失した数量",
    controlled_search_detail: "捜索状況",
    incident_summary: "事件・事故の概要",
    incident_detail: "事件・事故の内容詳細",
    occurrence_datetime: "発生日時",
    post_incident_action: "発生後の対応",
    facility_homecare: "速報判断：施設在宅関与",
    facility_name: "施設名",
    urgent_narcotic_related: "速報判断：麻薬・覚醒剤原料の関与",
    urgent_external_contact: "速報判断：保健所等社外対応",
    urgent_secondary_complaint: "速報判断：2次クレーム",
    urgent_taken: "速報判断：服用の有無",
    urgent_health: "速報判断：健康被害",
    urgent_health_detail: "速報判断：健康被害の内容",
    urgent_hospitalized: "速報判断：入院の有無",
    supplement: "補足事項"
  };

  const STORE_MASTER = {
    "000769": {
      sales_department: "第1医療営業部",
      district: "大阪北地区",
      psv_name: "佐藤PSV"
    },
    "000001": {
      sales_department: "第1医療営業部",
      district: "モデル地区",
      psv_name: "山田PSV"
    },
    "999999": {
      sales_department: "阪神調剤営業部",
      district: "検証地区",
      psv_name: "田中PSV"
    }
  };

  /* ── 文字サイズ 5段階 ── */
  const FONT_SIZES = [
    { cls: "font-xsmall", label: "最小" },
    { cls: "font-small",  label: "小" },
    { cls: "font-medium", label: "標準" },
    { cls: "font-large",  label: "大" },
    { cls: "font-xlarge", label: "最大" }
  ];
  const FONT_DEFAULT_INDEX = 2;
  let fontSizeIndex = (() => {
    try {
      const saved = parseInt(localStorage.getItem("hl_font_size_index"), 10);
      return Number.isFinite(saved) && saved >= 0 && saved < FONT_SIZES.length ? saved : FONT_DEFAULT_INDEX;
    } catch { return FONT_DEFAULT_INDEX; }
  })();

  /* ── ログ管理 ── */
  const LOG_STORAGE_KEY = "hl_report_logs";

  function loadLogs() {
    try { return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || "[]"); } catch { return []; }
  }

  function saveLog(entry) {
    try {
      const logs = loadLogs();
      logs.push(entry);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch { /* localStorage quota exceeded */ }
  }

  function downloadLogs() {
    const logs = loadLogs();
    if (logs.length === 0) {
      alert("保存済みのログがありません。");
      return;
    }
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hotline_logs_${formatDate(new Date()).replace(/\//g, "")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const state = {
    answers: {},
    drafts: {},
    messages: [],
    currentKey: null,
    mode: "question",
    pendingSummary: null,
    editReturn: null,
    error: "",
    startedAt: new Date(),
    completedId: "",
    attachedFiles: [],
    voice: {
      listening: false,
      targetKey: "",
      mode: "",
      transcript: "",
      message: "",
      error: ""
    }
  };

  const chatLog = document.getElementById("chatLog");
  const questionArea = document.getElementById("questionArea");
  const progressText = document.getElementById("progressText");
  const editButton = document.getElementById("editButton");
  const phoneButton = document.getElementById("phoneButton");
  const fontButton = document.getElementById("fontButton");
  const resetButton = document.getElementById("resetButton");
  const downloadLogButton = document.getElementById("downloadLogButton");

  let recognitionInstance = null;

  function setAppHeight() {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    if (viewportHeight) {
      document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
    }
  }

  function preventViewportZoom() {
    let lastTouchEnd = 0;
    document.addEventListener("gesturestart", (event) => event.preventDefault());
    document.addEventListener("gesturechange", (event) => event.preventDefault());
    document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
    document.addEventListener("touchend", (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener("wheel", (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
  }

  function bindViewportGuards() {
    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setAppHeight);
      window.visualViewport.addEventListener("scroll", setAppHeight);
    }
    preventViewportZoom();
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  }

  function formatTime(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
  }

  function recentDateOptions() {
    const today = new Date();
    const options = [];
    for (let i = 0; i <= 14; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (i === 0) options.push(`本日（${formatDate(d)}）`);
      else if (i === 1) options.push(`昨日（${formatDate(d)}）`);
      else options.push(`${i}日前（${formatDate(d)}）`);
    }
    options.push("それ以前", "不明");
    return options;
  }

  function hasAnswer(key) {
    return Object.prototype.hasOwnProperty.call(state.answers, key);
  }

  function answerText(key) {
    const value = state.answers[key];
    if (value === undefined || value === null || value === "") return "なし";
    return String(value);
  }

  function isDispensing() {
    return state.answers.category === CATEGORIES.DISPENSING;
  }

  function isPrivacy() {
    return state.answers.category === CATEGORIES.PRIVACY;
  }

  function isControlledLoss() {
    return state.answers.category === CATEGORIES.CONTROLLED_LOSS;
  }

  function isOtherTrouble() {
    return state.answers.category === CATEGORIES.OTHER;
  }

  function isYes(value) {
    const text = String(value || "").trim();
    return text === "あり" || text === "有" || text.startsWith("あり") || text.includes("あり（");
  }

  function isTakenYes() {
    return state.answers.taken === "服用した" || isYes(state.answers.urgent_taken);
  }

  function isHealthYes() {
    return state.answers.health === "あり（症状あり）" || isYes(state.answers.urgent_health);
  }

  function getSecondaryComplaintValue() {
    return state.answers.secondary_complaint || state.answers.urgent_secondary_complaint || "";
  }

  function parsePatientAge(value) {
    const text = String(value || "").trim();
    if (!text || text === "不明") return null;
    const hankaku = text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    const match = hankaku.match(/\d+(?:\.\d+)?/);
    if (!match) return null;
    const age = Number(match[0]);
    return Number.isFinite(age) ? age : null;
  }

  function trueFalsePrompt() {
    const type = state.answers.mistake_type;
    if (type === "渡し忘れ") {
      return "渡し忘れた薬剤名や数量を、分かる範囲で教えてください。";
    }
    if (type === "異薬異物混入") {
      return "本来の薬剤と、混入していたものを教えてください。";
    }
    if (type === "別患者への投薬") {
      return "本来の患者様と、実際に渡した患者様について分かる範囲で教えてください。";
    }
    if (type === "疑義照会漏れ") {
      return "疑義照会が必要だった内容を、分かる範囲で入力してください。後でAIが短く整理します。";
    }
    return "正しい内容と、実際に起きた内容を入力してください。薬剤名・数量・規格など、分かる範囲で大丈夫です。";
  }

  function lookupStoreInfo() {
    const code = String(state.answers.store_code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return {
        sales_department: "未反映",
        district: "未反映",
        psv_name: "未反映"
      };
    }

    if (STORE_MASTER[code]) return STORE_MASTER[code];

    const headquarter = state.answers.headquarter || "医療営業本部";
    const lastDigit = Number(code.slice(-1));
    const departmentIndex = Number.isFinite(lastDigit) ? (lastDigit % 4) + 1 : 1;
    const districtNames = headquarter === "阪神調剤営業本部"
      ? ["阪神第1地区", "阪神第2地区", "阪神第3地区", "阪神第4地区"]
      : ["東日本地区", "中日本地区", "西日本地区", "関西地区"];
    const psvNames = ["佐藤PSV", "鈴木PSV", "田中PSV", "高橋PSV"];

    return {
      sales_department: headquarter === "阪神調剤営業本部" ? `阪神調剤第${departmentIndex}営業部` : `第${departmentIndex}医療営業部`,
      district: districtNames[departmentIndex - 1],
      psv_name: psvNames[departmentIndex - 1]
    };
  }

  function makeQuestions() {
    const dateOptions = recentDateOptions();

    const categoryQuestion = {
      key: "category",
      label: QUESTION_LABELS.category,
      type: "choice",
      choices: CATEGORY_OPTIONS,
      bot: "まず、今回の内容に近い分類を選んでください。AIは重大度を判定しません。すべてホットラインへ共有され、人が確認します。",
      help: "迷う場合は、いちばん近いものを選んでください。最後に修正できます。"
    };

    if (!hasAnswer("category")) return [categoryQuestion];

    const commonQuestions = [
      categoryQuestion,
      {
        key: "mistake_type",
        label: QUESTION_LABELS.mistake_type,
        type: "choice",
        choices: MISTAKE_TYPES,
        condition: () => isDispensing(),
        bot: "調剤ミスの種類を選びましょう。分からない場合は「その他」で進められます。",
        help: "この選択に合わせて、後の質問を自動で調整します。"
      },
      {
        key: "headquarter",
        label: QUESTION_LABELS.headquarter,
        type: "choice",
        choices: HEADQUARTER_OPTIONS,
        bot: "本部区分を選んでください。店番入力後に、営業部・地区名・PSV名を自動で反映します。",
        help: "該当する本部を選んでください。迷う場合は、普段の所属区分に近いものを選んでください。"
      },
      {
        key: "store_code",
        label: QUESTION_LABELS.store_code,
        type: "text",
        inputMode: "numeric",
        maxLength: 6,
        bot: "次に、店舗を確認します。店番を6桁の数字で入力してください。",
        placeholder: "例：000769",
        help: "6桁の数字のみです。ハイフンや店舗名は入れないでください。音声入力の場合は、数字を一桁ずつ話しても入力できます。",
        validate: (value) => /^\d{6}$/.test(value.trim()) ? "" : "店番は6桁の数字で入力してください。例：000769"
      },
      {
        key: "store_name",
        label: QUESTION_LABELS.store_name,
        type: "text",
        bot: "店舗名を入力してください。店番と店舗名の両方を記録します。",
        placeholder: "例：スギ薬局 〇〇店",
        help: "正式名称が分からない場合は、普段使っている店舗名で大丈夫です。"
      }
    ];

    const dispensingQuestions = [
      {
        key: "medical_institution",
        label: QUESTION_LABELS.medical_institution,
        type: "text",
        bot: "処方元の医療機関名を入力してください。",
        placeholder: "例：〇〇クリニック",
        help: "分かる範囲で入力してください。"
      },
      {
        key: "dose_date",
        label: QUESTION_LABELS.dose_date,
        type: "choice",
        isDateQuestion: true,
        choices: dateOptions,
        bot: "投薬日を選んでください。正確でなくても、分かる範囲で大丈夫です。",
        help: "カレンダーで選ぶか、下の一覧から選んでください。「それ以前」「不明」も選べます。"
      },
      {
        key: "discovery_date",
        label: QUESTION_LABELS.discovery_date,
        type: "choice",
        isDateQuestion: true,
        choices: dateOptions,
        bot: "発覚日を選んでください。",
        help: "カレンダーで選ぶか、下の一覧から選んでください。"
      },
      {
        key: "patient_type",
        label: QUESTION_LABELS.patient_type,
        type: "choice",
        choices: ["新患（初めて）", "既患", "不明"],
        bot: "患者様は新患か既患かを選んでください。",
        help: "分からない場合は「不明」で進められます。"
      },
      {
        key: "patient_gender",
        label: QUESTION_LABELS.patient_gender,
        type: "choice",
        choices: ["男性", "女性", "その他", "不明"],
        bot: "患者様の性別を選んでください。",
        help: "分からない場合は「不明」で進められます。"
      },
      {
        key: "patient_age",
        label: QUESTION_LABELS.patient_age,
        type: "text",
        inputMode: "numeric",
        bot: "患者様の年齢を入力してください。分からない場合は「不明」と入力してください。",
        placeholder: "例：5歳、72歳、不明",
        help: "6歳未満の服用がある場合は速報対象になります。年齢が分からない場合は不明で進めてください。"
      },
      {
        key: "true_false_info",
        label: QUESTION_LABELS.true_false_info,
        type: "textarea",
        bot: () => trueFalsePrompt(),
        placeholder: "例：フロセミド錠10㎎　スピロノラクトン錠20㎎　1日1回朝食後　14日分",
        help: "文章が整っていなくても大丈夫です。必要に応じてAIが要約確認します。",
        summarize: () => state.answers.mistake_type === "疑義照会漏れ"
      },
      {
        key: "input_error",
        label: QUESTION_LABELS.input_error,
        type: "choice",
        choices: ["有", "無", "不明"],
        bot: "今回の調剤ミスに、入力ミスや入力漏れが関係していますか。",
        help: "現時点で分かる範囲で選んでください。"
      },
      {
        key: "taken",
        label: QUESTION_LABELS.taken,
        type: "choice",
        choices: ["服用した", "服用していない", "不明"],
        bot: "患者様が実際に服用したかを選んでください。",
        help: "分からない場合は「不明」で進めてください。"
      },
      {
        key: "taken_count",
        label: QUESTION_LABELS.taken_count,
        type: "text",
        condition: () => state.answers.taken === "服用した",
        bot: "服用した回数や日数を、分かる範囲で入力してください。",
        placeholder: "例：1回のみ、朝夕2回、3日分など",
        help: "正確な回数が不明な場合は「不明」と入力できます。"
      },
      {
        key: "health",
        label: QUESTION_LABELS.health,
        type: "choice",
        choices: ["あり（症状あり）", "なし", "不明"],
        bot: "健康被害や症状の有無を選んでください。AIは判断せず、そのままホットラインへ共有します。",
        help: "判断に迷う場合は「不明」で進めてください。"
      },
      {
        key: "health_detail",
        label: QUESTION_LABELS.health_detail,
        type: "textarea",
        condition: () => state.answers.health === "あり（症状あり）",
        bot: "症状について、聞いている範囲で入力してください。後でAIが短く整理します。",
        placeholder: "例：服用後にめまいを訴えた。現在は自宅で様子を見ている。受診予定は未確認。",
        help: "診断や判断ではなく、確認できている事実だけで大丈夫です。",
        summarize: () => true
      },
      {
        key: "finder",
        label: QUESTION_LABELS.finder,
        type: "choice",
        choices: ["患者", "薬局", "その他", "不明"],
        bot: "今回の事案は誰が発見しましたか。",
        help: "近いものを選んでください。"
      },
      {
        key: "discovery_detail",
        label: QUESTION_LABELS.discovery_detail,
        type: "textarea",
        bot: "どのように発覚したかを入力してください。AIが読みやすく整理します。",
        placeholder: "例：患者様から電話があり、薬剤が違う可能性があると連絡を受けた。",
        help: "時系列が曖昧でも構いません。分かる範囲の事実を入力してください。",
        summarize: () => true
      },
      {
        key: "patient_reaction",
        label: QUESTION_LABELS.patient_reaction,
        type: "choice",
        choices: PATIENT_REACTIONS,
        bot: "患者様の現在の状態・反応に近いものを選んでください。",
        help: "現時点で近いものを選んでください。"
      },
      {
        key: "medical_report",
        label: QUESTION_LABELS.medical_report,
        type: "choice",
        choices: ["未報告", "報告済", "報告予定", "不要", "不明"],
        bot: "医療機関への報告状況を選んでください。",
        help: "現時点の状況を選んでください。"
      },
      {
        key: "patient_action_detail",
        label: QUESTION_LABELS.patient_action_detail,
        type: "textarea",
        bot: "現時点までの患者様への対応内容を入力してください。",
        placeholder: "例：患者様へ電話連絡済み。薬剤回収のため来局を依頼。未対応の場合は未対応と入力。",
        help: "対応途中でも大丈夫です。実施済み・予定していることを入力してください。",
        summarize: () => true
      },
      {
        key: "external_action_detail",
        label: QUESTION_LABELS.external_action_detail,
        type: "textarea",
        bot: "医療機関・保健所など、店舗外への対応状況を入力してください。",
        placeholder: "例：医療機関へ報告済み。保健所への相談は未実施。該当なしの場合は該当なしと入力。",
        help: "未実施・該当なしの場合も、そのまま入力してください。",
        summarize: () => true
      }
    ];

    const privacyQuestions = [
      {
        key: "discovery_detail",
        label: QUESTION_LABELS.discovery_detail,
        type: "textarea",
        bot: "どのように発覚したかを入力してください。AIが短く整理します。",
        placeholder: "例：患者様から、他人のお薬手帳が入っていると連絡があった。",
        help: "発覚の流れを分かる範囲で入力してください。",
        summarize: () => true
      },
      {
        key: "occurrence_date",
        label: QUESTION_LABELS.occurrence_date,
        type: "choice",
        isDateQuestion: true,
        choices: dateOptions,
        bot: "個人情報漏洩が発生した日を選んでください。",
        help: "カレンダーで選ぶか、下の一覧から選んでください。"
      },
      {
        key: "discovery_date",
        label: QUESTION_LABELS.discovery_date,
        type: "choice",
        isDateQuestion: true,
        choices: dateOptions,
        bot: "発覚日を選んでください。",
        help: "カレンダーで選ぶか、下の一覧から選んでください。"
      },
      {
        key: "patient_reaction",
        label: QUESTION_LABELS.patient_reaction,
        type: "choice",
        choices: PATIENT_REACTIONS,
        bot: "患者様または関係者の現在の状態・反応に近いものを選んでください。",
        help: "現時点で近いものを選んでください。"
      },
      {
        key: "leaked_document",
        label: QUESTION_LABELS.leaked_document,
        type: "text",
        bot: "漏洩した書類名やデータ名を入力してください。",
        placeholder: "例：処方せん、お薬手帳、薬袋、会計情報など",
        help: "複数ある場合は、分かる範囲で並べて入力してください。"
      },
      {
        key: "privacy_who_to_whom",
        label: QUESTION_LABELS.privacy_who_to_whom,
        type: "textarea",
        bot: "誰の何を、誰に渡したかを入力してください。AIが短く整理します。",
        placeholder: "例：A様のお薬手帳を、誤ってB様に渡した可能性がある。",
        help: "個人名は必要最小限で構いません。分かる範囲で入力してください。",
        summarize: () => true
      },
      {
        key: "recovery_action",
        label: QUESTION_LABELS.recovery_action,
        type: "textarea",
        bot: "回収対応の状況を入力してください。",
        placeholder: "例：B様へ連絡済み。お薬手帳は回収予定。まだ連絡が取れていない。",
        help: "対応途中の内容で大丈夫です。",
        summarize: () => true
      },
      {
        key: "leak_destination_action",
        label: QUESTION_LABELS.leak_destination_action,
        type: "textarea",
        bot: "漏洩先への説明・対応状況を入力してください。",
        placeholder: "例：誤って受け取った方へ説明済み。内容を見ていないことを確認中。",
        help: "現時点の状況を入力してください。",
        summarize: () => true
      },
      {
        key: "external_action_detail",
        label: QUESTION_LABELS.external_action_detail,
        type: "textarea",
        bot: "医療機関・保健所など、店舗外への対応状況を入力してください。",
        placeholder: "例：医療機関への報告は未実施。保健所への相談予定なし。",
        help: "未実施・該当なしの場合も、そのまま入力してください。",
        summarize: () => true
      },
      {
        key: "secondary_complaint",
        label: QUESTION_LABELS.secondary_complaint,
        type: "choice",
        choices: YES_NO_UNKNOWN,
        bot: "2次クレームへ発展している、または発展しそうな状況はありますか。",
        help: "現時点で分かる範囲で選んでください。"
      }
    ];

    const controlledLossQuestions = [
      {
        key: "controlled_class",
        label: QUESTION_LABELS.controlled_class,
        type: "choice",
        choices: ["麻薬", "覚醒剤原料", "毒薬", "向精神薬", "その他", "不明"],
        bot: "紛失した医薬品の分類を選んでください。",
        help: "分類が分からない場合は「不明」で進めてください。"
      },
      {
        key: "controlled_medicine_name",
        label: QUESTION_LABELS.controlled_medicine_name,
        type: "text",
        bot: "医薬品名を入力してください。",
        placeholder: "例：〇〇錠、〇〇散など",
        help: "分かる範囲で入力してください。"
      },
      {
        key: "controlled_lost_qty",
        label: QUESTION_LABELS.controlled_lost_qty,
        type: "text",
        bot: "紛失した数量を入力してください。",
        placeholder: "例：10錠、1本、数量確認中など",
        help: "不明点は不明のままで構いません。"
      },
      {
        key: "discovery_detail",
        label: QUESTION_LABELS.discovery_detail,
        type: "textarea",
        bot: "どのように発覚したかを入力してください。AIが短く整理します。",
        placeholder: "例：終業時の在庫確認で帳簿数量と実在庫が一致しないことに気づいた。",
        help: "発覚の流れを分かる範囲で入力してください。",
        summarize: () => true
      },
      {
        key: "discovery_date",
        label: QUESTION_LABELS.discovery_date,
        type: "choice",
        isDateQuestion: true,
        choices: dateOptions,
        bot: "発覚日を選んでください。",
        help: "カレンダーで選ぶか、下の一覧から選んでください。"
      },
      {
        key: "controlled_search_detail",
        label: QUESTION_LABELS.controlled_search_detail,
        type: "textarea",
        bot: "捜索状況を入力してください。AIが短く整理します。",
        placeholder: "例：調剤室内、廃棄ボックス、投薬した患者様への確認を実施中。",
        help: "実施済み・確認中・未実施を分かる範囲で入力してください。",
        summarize: () => true
      },
      {
        key: "external_action_detail",
        label: QUESTION_LABELS.external_action_detail,
        type: "textarea",
        bot: "医療機関・保健所など、店舗外への対応状況を入力してください。",
        placeholder: "例：保健所へ相談予定。警察への連絡は未実施。該当なしの場合は該当なしと入力。",
        help: "未実施・該当なしの場合も、そのまま入力してください。",
        summarize: () => true
      },
      {
        key: "secondary_complaint",
        label: QUESTION_LABELS.secondary_complaint,
        type: "choice",
        choices: YES_NO_UNKNOWN,
        bot: "2次クレームへ発展している、または発展しそうな状況はありますか。",
        help: "現時点で分かる範囲で選んでください。"
      }
    ];

    const otherTroubleQuestions = [
      {
        key: "incident_summary",
        label: QUESTION_LABELS.incident_summary,
        type: "textarea",
        bot: "事件・事故の概要を入力してください。AIが短く整理します。",
        placeholder: "例：店舗駐車場で車両接触が発生。けが人は確認中。警察連絡は未実施。",
        help: "クレーム・事故・法令遵守違反・その他の相談をここに入力できます。",
        summarize: () => true
      },
      {
        key: "incident_detail",
        label: QUESTION_LABELS.incident_detail,
        type: "textarea",
        bot: "事件・事故の内容詳細を入力してください。",
        placeholder: "例：患者様から強い苦情があり、店舗責任者で一次対応中。詳細は確認中。",
        help: "断定せず、確認できている事実だけで大丈夫です。",
        summarize: () => true
      },
      {
        key: "occurrence_datetime",
        label: QUESTION_LABELS.occurrence_datetime,
        type: "text",
        bot: "発生日時を入力してください。",
        placeholder: "例：本日14時頃、2025/4/15 午前、不明",
        help: "正確な時刻が分からない場合は、おおよその時間で大丈夫です。"
      },
      {
        key: "discovery_detail",
        label: QUESTION_LABELS.discovery_detail,
        type: "textarea",
        bot: "どのように発覚したかを入力してください。AIが読みやすく整理します。",
        placeholder: "例：店舗スタッフから管理者へ連絡があり、状況を確認した。",
        help: "時系列が曖昧でも構いません。分かる範囲の事実を入力してください。",
        summarize: () => true
      },
      {
        key: "patient_reaction",
        label: QUESTION_LABELS.patient_reaction,
        type: "choice",
        choices: PATIENT_REACTIONS,
        bot: "患者様または関係者の現在の状態・反応に近いものを選んでください。",
        help: "現時点で近いものを選んでください。"
      },
      {
        key: "post_incident_action",
        label: QUESTION_LABELS.post_incident_action,
        type: "textarea",
        bot: "発生後の対応を入力してください。AIが短く整理します。",
        placeholder: "例：店舗責任者が一次対応済み。警察への連絡は未実施。営業部へ連絡予定。",
        help: "未対応の場合も、そのまま入力してください。",
        summarize: () => true
      },
      {
        key: "external_action_detail",
        label: QUESTION_LABELS.external_action_detail,
        type: "textarea",
        bot: "医療機関・保健所・警察など、店舗外への対応状況を入力してください。",
        placeholder: "例：警察へ連絡済み。保健所への相談は未実施。該当なしの場合は該当なしと入力。",
        help: "未実施・該当なしの場合も、そのまま入力してください。",
        summarize: () => true
      }
    ];

    const urgentQuestions = [
      {
        key: "facility_homecare",
        label: QUESTION_LABELS.facility_homecare,
        type: "choice",
        choices: YES_NO,
        bot: "速報判断の確認です。施設在宅に関わる内容ですか。",
        help: "施設在宅に関係する場合は「あり」を選んでください。"
      },
      {
        key: "facility_name",
        label: QUESTION_LABELS.facility_name,
        type: "text",
        condition: () => isYes(state.answers.facility_homecare),
        bot: "施設在宅に関わる場合、施設名を入力してください。",
        placeholder: "例：〇〇ホーム、〇〇施設",
        help: "分かる範囲で入力してください。"
      },
      {
        key: "urgent_narcotic_related",
        label: QUESTION_LABELS.urgent_narcotic_related,
        type: "choice",
        choices: YES_NO,
        bot: "麻薬または覚醒剤原料が関わる内容ですか。",
        help: "管理薬剤の紛失だけでなく、回収・廃棄手続きなども含めて確認してください。"
      },
      {
        key: "urgent_external_contact",
        label: QUESTION_LABELS.urgent_external_contact,
        type: "choice",
        choices: YES_NO,
        bot: "保健所・警察・行政など、社外への対応が発生していますか。",
        help: "相談予定・報告予定を含める場合は「あり」を選んでください。"
      },
      {
        key: "urgent_secondary_complaint",
        label: QUESTION_LABELS.urgent_secondary_complaint,
        type: "choice",
        choices: YES_NO,
        condition: () => !isPrivacy() && !isControlledLoss(),
        bot: "2次クレームに発展している、または発展しそうな状況はありますか。",
        help: "現時点で近いものを選んでください。"
      },
      {
        key: "urgent_taken",
        label: QUESTION_LABELS.urgent_taken,
        type: "choice",
        choices: YES_NO,
        condition: () => !isDispensing(),
        bot: "速報判断の確認です。服用が発生していますか。",
        help: "調剤ミス以外でも服用が関係する場合は「あり」を選んでください。"
      },
      {
        key: "urgent_health",
        label: QUESTION_LABELS.urgent_health,
        type: "choice",
        choices: YES_NO,
        condition: () => !isDispensing() && isYes(state.answers.urgent_taken),
        bot: "服用がある場合、健康被害はありますか。",
        help: "症状・受診・入院などがあれば「あり」を選んでください。"
      },
      {
        key: "urgent_health_detail",
        label: QUESTION_LABELS.urgent_health_detail,
        type: "textarea",
        condition: () => !isDispensing() && isYes(state.answers.urgent_health),
        bot: "健康被害の内容を入力してください。AIが短く整理します。",
        placeholder: "例：服用後に気分不良を訴えている。受診予定は未確認。",
        help: "診断ではなく、確認できている事実だけで大丈夫です。",
        summarize: () => true
      },
      {
        key: "urgent_hospitalized",
        label: QUESTION_LABELS.urgent_hospitalized,
        type: "choice",
        choices: YES_NO_UNKNOWN,
        condition: () => isHealthYes(),
        bot: "入院の有無を選んでください。",
        help: "現時点で分からない場合は「不明」を選んでください。"
      },
      {
        key: "supplement",
        label: QUESTION_LABELS.supplement,
        type: "textarea",
        optional: true,
        bot: "最後に、他に伝えておきたいことがあれば入力してください。なければ空欄のまま進めます。",
        placeholder: "例：担当者名、折り返し希望時間、追加で気になる点など",
        help: "補足がない場合は「補足なしで進む」を押してください。"
      }
    ];

    let categorySpecificQuestions = [];
    if (isDispensing()) categorySpecificQuestions = dispensingQuestions;
    else if (isPrivacy()) categorySpecificQuestions = privacyQuestions;
    else if (isControlledLoss()) categorySpecificQuestions = controlledLossQuestions;
    else if (isOtherTrouble()) categorySpecificQuestions = otherTroubleQuestions;

    return commonQuestions.concat(categorySpecificQuestions, urgentQuestions).filter((q) => !q.condition || q.condition());
  }

  function getQuestion(key) {
    return makeQuestions().find((q) => q.key === key) || null;
  }

  function isAnswered(q) {
    if (!hasAnswer(q.key)) return false;
    if (q.optional) return true;
    return String(state.answers[q.key]).trim() !== "";
  }

  function allAnswered() {
    return makeQuestions().every((q) => isAnswered(q));
  }

  function warmLeadForQuestion(key) {
    const leads = {
      category: "ご連絡ありがとうございます。まずは落ち着いて、いちばん近い内容を一緒に選びましょう。",
      mistake_type: "ここから先は、必要なことだけ順番に確認していきます。",
      headquarter: "店舗の所属情報を確認します。分かる範囲で選んでください。",
      store_code: "店舗の確認から、ゆっくり進めます。",
      store_name: "ありがとうございます。続いて店舗名を確認します。分かる範囲で大丈夫です。",
      medical_institution: "ここも分かる範囲で大丈夫です。処方元の医療機関を確認します。",
      dose_date: "日付は正確でなくても構いません。近いものを選んでください。",
      discovery_date: "発覚した日を、分かる範囲で選びましょう。",
      patient_type: "患者様について、分かる範囲だけ教えてください。",
      patient_gender: "患者様情報を必要最小限で確認します。",
      patient_age: "年齢は速報判断に使います。分からない場合は不明で大丈夫です。",
      true_false_info: "文章を整える必要はありません。あとでAIが読みやすく整理します。",
      input_error: "入力ミスの有無を確認します。分かる範囲で大丈夫です。",
      taken: "確認できている範囲で大丈夫です。服用の有無を選んでください。",
      taken_count: "分かっている回数や日数だけで構いません。",
      health: "ここでは判断ではなく、事実として分かる範囲を共有します。",
      health_detail: "症状は、聞いている範囲だけで大丈夫です。",
      finder: "発見者を確認します。近いものを選んでください。",
      discovery_detail: "発覚の経緯を確認します。時系列が整っていなくても大丈夫です。",
      patient_reaction: "患者様や関係者の反応も、現時点で近いものを選べば大丈夫です。",
      medical_report: "医療機関への報告状況を確認します。",
      patient_action_detail: "対応途中でも大丈夫です。事実だけ入力してください。",
      external_action_detail: "社外対応の有無を確認します。該当なしでもそのまま入力できます。",
      occurrence_date: "発生日を確認します。正確でない場合は不明で大丈夫です。",
      leaked_document: "漏洩した情報を確認します。分かる範囲で入力してください。",
      privacy_who_to_whom: "個人情報漏洩の内容を整理します。分かる範囲の事実をそのまま入力してください。",
      recovery_action: "回収対応の状況を確認します。途中経過で大丈夫です。",
      leak_destination_action: "漏洩先への対応状況を確認します。",
      secondary_complaint: "2次クレームの有無を確認します。",
      controlled_class: "管理薬剤の件ですね。慎重に、でも焦らず確認していきます。",
      controlled_medicine_name: "医薬品名は分かる範囲で大丈夫です。",
      controlled_lost_qty: "数量を確認します。不明な場合は不明で進められます。",
      controlled_search_detail: "捜索状況を共有できれば大丈夫です。",
      incident_summary: "その他トラブルとして内容を整理します。",
      incident_detail: "確認できている事実だけ入力してください。",
      occurrence_datetime: "発生日時を確認します。おおよそでも大丈夫です。",
      post_incident_action: "発生後の対応を確認します。未対応でもそのまま入力できます。",
      facility_homecare: "ここから速報判断に必要な確認です。短い選択で進めます。",
      facility_name: "施設名を確認します。分かる範囲で大丈夫です。",
      urgent_narcotic_related: "麻薬・覚醒剤原料の関与を確認します。",
      urgent_external_contact: "社外対応の有無を確認します。",
      urgent_secondary_complaint: "2次クレームの有無を確認します。",
      urgent_taken: "速報判断として、服用の有無を確認します。",
      urgent_health: "健康被害の有無を確認します。",
      urgent_health_detail: "健康被害の内容を確認します。",
      urgent_hospitalized: "入院の有無を確認します。",
      supplement: "最後です。気になることがあれば、ここに残せます。なければ空欄で進められます。"
    };
    return leads[key] || "分かる範囲で、一つずつ確認していきます。";
  }

  function getQuestionText(q) {
    const base = typeof q.bot === "function" ? q.bot() : q.bot;
    const lead = warmLeadForQuestion(q.key);
    return `${lead}\n${base}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addMessage(role, text, small) {
    state.messages.push({ role, text, small: small || "" });
  }

  function summarizeText(text) {
    let s = text.trim();
    const replacements = [
      [/えーっと/g, ""],
      [/えっと/g, ""],
      [/あのー/g, ""],
      [/あの、/g, ""],
      [/その、/g, ""],
      [/なんというか/g, ""],
      [/ちょっと/g, ""],
      [/少し/g, ""],
      [/みたいな/g, ""],
      [/という感じで/g, ""],
      [/と思います/g, ""],
      [/ですね/g, ""],
      [/んですが/g, ""],
      [/\s+/g, " "]
    ];
    replacements.forEach(([pattern, replacement]) => {
      s = s.replace(pattern, replacement);
    });
    s = s.replace(/[、,]\s*$/g, "").trim();
    s = s.replace(/。{2,}/g, "。");
    if (s && !/[。！？!?]$/.test(s)) s += "。";
    return s;
  }

  function needsSummary(q, value) {
    const flag = typeof q.summarize === "function" ? q.summarize() : q.summarize;
    return Boolean(flag) && value.trim().length >= 15;
  }

  function captureCurrentDraft() {
    const input = document.getElementById("answerInput");
    if (input && state.currentKey) {
      state.drafts[state.currentKey] = input.value;
    }
  }

  function cleanupAfterAnswer(key, newValue, oldValue) {
    if (key === "category" && oldValue !== undefined && oldValue !== newValue) {
      const keep = new Set(["category", "headquarter", "store_code", "store_name"]);
      Object.keys(state.answers).forEach((k) => {
        if (!keep.has(k)) delete state.answers[k];
      });
      Object.keys(state.drafts).forEach((k) => {
        if (!keep.has(k)) delete state.drafts[k];
      });
    }

    if (key === "headquarter" && oldValue !== undefined && oldValue !== newValue) {
      // 担当情報は店番と本部区分から都度算出するため、回答値の削除は不要。
    }

    if (key === "mistake_type" && oldValue !== undefined && oldValue !== newValue) {
      delete state.answers.true_false_info;
      delete state.drafts.true_false_info;
    }

    if (key === "taken" && newValue !== "服用した") {
      delete state.answers.taken_count;
      delete state.drafts.taken_count;
    }

    if (key === "health" && newValue !== "あり（症状あり）") {
      delete state.answers.health_detail;
      delete state.drafts.health_detail;
    }

    if (key === "facility_homecare" && !isYes(newValue)) {
      delete state.answers.facility_name;
      delete state.drafts.facility_name;
    }

    if (key === "urgent_taken" && !isYes(newValue)) {
      delete state.answers.urgent_health;
      delete state.answers.urgent_health_detail;
      delete state.drafts.urgent_health_detail;
      if (!isDispensing()) delete state.answers.urgent_hospitalized;
    }

    if (key === "urgent_health" && !isYes(newValue)) {
      delete state.answers.urgent_health_detail;
      delete state.answers.urgent_hospitalized;
      delete state.drafts.urgent_health_detail;
    }

    if (key === "health" && newValue !== "あり（症状あり）" && isDispensing()) {
      delete state.answers.urgent_hospitalized;
    }

    const activeKeys = new Set(makeQuestions().map((q) => q.key));
    Object.keys(state.answers).forEach((k) => {
      if (!activeKeys.has(k)) delete state.answers[k];
    });
    Object.keys(state.drafts).forEach((k) => {
      if (!activeKeys.has(k)) delete state.drafts[k];
    });
  }

  function saveAnswer(key, value) {
    const oldValue = state.answers[key];
    state.answers[key] = value;
    delete state.drafts[key];
    cleanupAfterAnswer(key, value, oldValue);
  }

  function validateAnswer(q, value) {
    if (q.optional && value.trim() === "") return "";
    if (q.validate) return q.validate(value);
    if (String(value).trim() === "") return `${q.label}を入力してください。`;
    return "";
  }

  function askQuestion(key) {
    const q = getQuestion(key);
    if (!q) {
      showConfirm();
      return;
    }
    state.mode = "question";
    state.currentKey = key;
    state.error = "";
    clearVoiceState();
    addMessage("bot", getQuestionText(q), q.help || "");
    render();
  }

  function askNext(fromKey) {
    const questions = makeQuestions();
    let startIndex = 0;
    if (fromKey) {
      const idx = questions.findIndex((q) => q.key === fromKey);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    for (let i = startIndex; i < questions.length; i += 1) {
      if (!isAnswered(questions[i])) {
        askQuestion(questions[i].key);
        return;
      }
    }

    for (let i = 0; i < questions.length; i += 1) {
      if (!isAnswered(questions[i])) {
        askQuestion(questions[i].key);
        return;
      }
    }

    showConfirm();
  }

  function afterSaved(key) {
    if (key === "store_code") {
      const info = lookupStoreInfo();
      addMessage(
        "bot",
        `店番から担当情報を反映しました。\n営業部：${info.sales_department}\n地区名：${info.district}\nPSV名：${info.psv_name}`,
        "この担当情報はモックの自動反映です。実運用では店舗マスタから取得します。"
      );
    }

    const editReturn = state.editReturn;
    state.editReturn = null;

    if (editReturn) {
      if (editReturn.mode === "confirm" && allAnswered()) {
        showConfirm();
        return;
      }
      if (editReturn.currentKey) {
        const returnQuestion = getQuestion(editReturn.currentKey);
        if (returnQuestion && !isAnswered(returnQuestion)) {
          askQuestion(editReturn.currentKey);
          return;
        }
      }
    }

    askNext(key);
  }

  function submitAnswer(value) {
    const q = getQuestion(state.currentKey);
    if (!q) return;

    const normalizedValue = String(value == null ? "" : value).trim();
    const error = validateAnswer(q, normalizedValue);
    if (error) {
      state.error = `大丈夫です。${error}`;
      state.drafts[q.key] = normalizedValue;
      render();
      return;
    }

    state.error = "";
    clearVoiceState();
    addMessage("user", normalizedValue || "補足なし");

    if (needsSummary(q, normalizedValue)) {
      const summary = summarizeText(normalizedValue);
      if (summary && summary !== normalizedValue) {
        state.pendingSummary = {
          key: q.key,
          label: q.label,
          original: normalizedValue,
          summary
        };
        state.mode = "summary";
        addMessage("bot", "ありがとうございます。入力していただいた内容を、読みやすいように短く整理しました。この内容で記録してよいか、一緒に確認しましょう。", "内容の意味は変えず、言いよどみや冗長な表現だけを整えます。");
        render();
        return;
      }
    }

    saveAnswer(q.key, normalizedValue);
    afterSaved(q.key);
  }

  function chooseSummary(action) {
    const pending = state.pendingSummary;
    if (!pending) return;

    if (action === "adopt") {
      addMessage("user", "要約を採用します");
      saveAnswer(pending.key, pending.summary);
      state.pendingSummary = null;
      afterSaved(pending.key);
      return;
    }

    if (action === "original") {
      addMessage("user", "元の文章のまま使います");
      saveAnswer(pending.key, pending.original);
      state.pendingSummary = null;
      afterSaved(pending.key);
      return;
    }

    if (action === "rewrite") {
      addMessage("user", "書き直します");
      const key = pending.key;
      state.drafts[key] = pending.original;
      state.pendingSummary = null;
      askQuestion(key);
    }
  }

  function showConfirm() {
    state.mode = "confirm";
    state.currentKey = null;
    state.error = "";
    clearVoiceState();
    addMessage("bot", "ここまでありがとうございます。最後に入力内容を一緒に確認しましょう。修正したい項目があれば、その項目の「修正する」を押してください。", "まだ確定ではありません。最後のボタンを押すまで送信扱いにはなりません。");
    render();
  }

  function beginEdit(modeOverride) {
    const answered = makeQuestions().filter((q) => hasAnswer(q.key));
    if (answered.length === 0) return;
    captureCurrentDraft();
    state.editReturn = {
      mode: modeOverride || state.mode,
      currentKey: state.currentKey
    };
    state.mode = "editSelect";
    state.error = "";
    clearVoiceState();
    addMessage("bot", "修正したい項目だけ選んでください。必要なところだけ直せます。", "最初からやり直す必要はありません。ここまでの入力はできるだけ保持します。");
    render();
  }

  function selectEditKey(key) {
    const q = getQuestion(key);
    if (!q) return;
    state.currentKey = key;
    state.mode = "question";
    state.error = "";
    clearVoiceState();
    addMessage("bot", `「${q.label}」を修正します。現在の内容は「${answerText(key)}」です。`, "新しい内容を入力または選択してください。");
    render();
  }

  function submitFinal() {
    const reportId = `HL-${formatDate(new Date()).replace(/\//g, "")}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    state.completedId = reportId;
    state.mode = "complete";
    clearVoiceState();
    addMessage("user", "この内容でホットラインへ共有します");
    addMessage("bot", "受付しました。プロトタイプのため外部送信はしていませんが、実運用ではSlack通知と管理表転記がここで実行されます。", "AIは判定せず、すべて人が確認する前提です。");

    saveLog({
      id: reportId,
      timestamp: formatDateTime(new Date()),
      startedAt: formatDateTime(state.startedAt),
      answers: Object.assign({}, state.answers),
      attachedFiles: state.attachedFiles.slice()
    });

    render();
  }

  function phoneFallback() {
    addMessage("bot", "不安な場合は、通常のホットライン電話で相談してください。この画面の入力は途中でも問題ありません。電話に切り替えても大丈夫です。", "緊急性がある、判断に迷う、入力が難しい場合は電話を優先してください。入力を完璧に終わらせる必要はありません。");
    render();
  }

  function resetApp() {
    stopVoiceRecognition();
    state.answers = {};
    state.drafts = {};
    state.messages = [];
    state.currentKey = null;
    state.mode = "question";
    state.pendingSummary = null;
    state.editReturn = null;
    state.error = "";
    state.startedAt = new Date();
    state.completedId = "";
    state.attachedFiles = [];
    clearVoiceState();
    renderAttachedFiles();

    addMessage("bot", "こんにちは。ご連絡ありがとうございます。急いでいる中でも、必要な内容を一つずつ一緒に確認していきます。", "文章をきれいに書く必要はありません。選ぶだけで進められる項目を多くしています。分からないところは「不明」で進められます。");
    addMessage("bot", "このAIは、重大度やミスレベルを判定しません。すべての報告はホットライン担当へ共有し、人が確認します。", "途中で不安になった場合は、いつでも電話相談に切り替えられます。無理に最後まで入力しなくても大丈夫です。");
    askNext();
  }

  function getSpeechRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isSpeechSupported() {
    return Boolean(getSpeechRecognitionConstructor());
  }

  function clearVoiceState() {
    state.voice = {
      listening: false,
      targetKey: "",
      mode: "",
      transcript: "",
      message: "",
      error: ""
    };
  }

  function stopVoiceRecognition() {
    if (recognitionInstance) {
      try {
        recognitionInstance.onresult = null;
        recognitionInstance.onerror = null;
        recognitionInstance.onend = null;
        recognitionInstance.stop();
      } catch (error) {
        // 停止済みの場合は何もしない。
      }
      recognitionInstance = null;
    }
    if (state.voice.listening) {
      state.voice.listening = false;
    }
  }

  function normalizeForVoice(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[Ⅰ]/g, "1")
      .replace(/[Ⅱ]/g, "2")
      .replace(/[Ⅲ]/g, "3")
      .replace(/[Ⅳ]/g, "4")
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[\s\u3000・／\/\-ー―−＿_（）()【】\[\]「」『』。、，,.!！?？:：;；]/g, "")
      .replace(/を選択/g, "")
      .replace(/にします/g, "")
      .replace(/にする/g, "")
      .replace(/です/g, "")
      .replace(/お願いします/g, "")
      .trim();
  }

  function aliasesForChoice(choice, q) {
    const aliases = [choice];
    const noPrefix = choice.replace(/^[ⅠⅡⅢⅣ]\.\s*/, "");
    aliases.push(noPrefix);

    if (choice === CATEGORIES.DISPENSING) aliases.push("調剤", "調剤ミス", "薬の間違い", "薬剤ミス");
    if (choice === CATEGORIES.PRIVACY) aliases.push("個人情報", "情報漏洩", "個人情報漏洩", "漏洩");
    if (choice === CATEGORIES.CONTROLLED_LOSS) aliases.push("管理薬剤", "薬剤紛失", "紛失", "管理薬剤の紛失");
    if (choice === CATEGORIES.OTHER) aliases.push("その他", "その他トラブル", "クレーム", "事故", "法令", "法令違反");

    if (choice === "あり" || choice === "有" || choice.startsWith("あり")) aliases.push("有", "ある", "あります", "はい", "該当あり", "ありです");
    if (choice === "なし" || choice === "無") aliases.push("無", "ない", "ありません", "いいえ", "該当なし", "なしです");
    if (choice === "不明") aliases.push("わからない", "分からない", "不明です", "不詳");
    if (choice === "服用した") aliases.push("服用", "服用あり", "飲んだ", "飲みました", "服用しました");
    if (choice === "服用していない") aliases.push("服用なし", "飲んでいない", "飲んでません", "未服用");
    if (choice === "報告済") aliases.push("報告済み", "報告しました", "報告した");
    if (choice === "未報告") aliases.push("まだ報告していない", "報告していない", "未連絡");

    if (q && q.key === "patient_gender") {
      if (choice === "男性") aliases.push("男", "男性です");
      if (choice === "女性") aliases.push("女", "女性です");
    }

    return aliases;
  }

  function matchVoiceChoice(q, transcript) {
    const spoken = normalizeForVoice(transcript);
    if (!spoken) return "";

    const candidates = q.choices.map((choice) => {
      const aliases = aliasesForChoice(choice, q).map((alias) => normalizeForVoice(alias)).filter(Boolean);
      let score = 0;
      aliases.forEach((alias) => {
        if (spoken === alias) score = Math.max(score, 100 + alias.length);
        else if (spoken.includes(alias)) score = Math.max(score, 60 + alias.length);
        else if (alias.includes(spoken) && spoken.length >= 2) score = Math.max(score, 40 + spoken.length);
      });
      return { choice, score };
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] && candidates[0].score > 0 ? candidates[0].choice : "";
  }

  function appendDictationToDraft(key, transcript) {
    const q = getQuestion(key);
    if (!q) return;
    const existing = state.drafts[key] !== undefined
      ? state.drafts[key]
      : (hasAnswer(key) && state.answers[key] !== "" ? state.answers[key] : "");
    const separator = existing && q.type === "textarea" ? "\n" : (existing ? " " : "");
    state.drafts[key] = `${existing}${separator}${transcript}`.trim();
  }

  function startVoice(mode) {
    const q = getQuestion(state.currentKey);
    if (!q) return;

    captureCurrentDraft();

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      state.voice = {
        listening: false,
        targetKey: q.key,
        mode,
        transcript: "",
        message: "",
        error: "このブラウザでは音声入力を利用できません。テキスト入力またはボタン選択で進めてください。"
      };
      render();
      return;
    }

    stopVoiceRecognition();

    recognitionInstance = new Recognition();
    recognitionInstance.lang = "ja-JP";
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = false;
    recognitionInstance.maxAlternatives = 3;

    state.voice = {
      listening: true,
      targetKey: q.key,
      mode,
      transcript: "",
      message: mode === "choice" ? "聞き取り中です。選択肢の名前を話してください。" : "聞き取り中です。入力したい内容を話してください。",
      error: ""
    };
    render();

    recognitionInstance.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }

      state.voice.transcript = (finalText || interimText).trim();

      if (finalText.trim()) {
        applyVoiceResult(mode, q.key, finalText.trim());
      } else {
        render();
      }
    };

    recognitionInstance.onerror = (event) => {
      state.voice.listening = false;
      state.voice.error = event.error === "not-allowed"
        ? "マイクの利用が許可されていません。ブラウザのマイク許可を確認してください。"
        : "音声をうまく聞き取れませんでした。もう一度試すか、通常入力で進めてください。";
      state.voice.message = "";
      render();
    };

    recognitionInstance.onend = () => {
      recognitionInstance = null;
      if (state.voice.listening) {
        state.voice.listening = false;
        if (!state.voice.transcript && !state.voice.error) {
          state.voice.message = "音声入力を終了しました。聞き取れなかった場合は、もう一度押してください。";
        }
        render();
      }
    };

    try {
      recognitionInstance.start();
    } catch (error) {
      state.voice.listening = false;
      state.voice.error = "音声入力を開始できませんでした。少し待ってからもう一度試してください。";
      render();
    }
  }

  function applyVoiceResult(mode, key, transcript) {
    state.voice.listening = false;
    state.voice.transcript = transcript;
    stopVoiceRecognition();

    if (key !== state.currentKey || state.mode !== "question") {
      state.voice.error = "質問が切り替わったため、音声結果は反映しませんでした。";
      render();
      return;
    }

    const q = getQuestion(key);
    if (!q) return;

    if (mode === "choice") {
      const matched = matchVoiceChoice(q, transcript);
      if (!matched) {
        state.voice.error = `「${transcript}」を選択肢に一致させられませんでした。選択肢の言葉を短く話してください。`;
        state.voice.message = "";
        render();
        return;
      }
      clearVoiceState();
      submitAnswer(matched);
      return;
    }

    appendDictationToDraft(key, transcript);
    state.voice.message = "音声を入力欄に反映しました。内容を確認してから次へ進んでください。";
    state.voice.error = "";
    render();
  }

  function computeUrgency() {
    const reasons = [];
    const controlledClass = state.answers.controlled_class || "";
    const age = parsePatientAge(state.answers.patient_age);

    if (isOtherTrouble()) reasons.push("その他トラブル全件");
    if (isYes(state.answers.facility_homecare)) reasons.push("施設在宅関与あり");
    if (isYes(state.answers.urgent_narcotic_related)) reasons.push("麻薬・覚醒剤原料の関与あり");
    if (controlledClass === "麻薬" || controlledClass === "覚醒剤原料") reasons.push(`${controlledClass}の紛失`);
    if (isYes(state.answers.urgent_external_contact)) reasons.push("保健所等社外対応あり");
    if (isYes(getSecondaryComplaintValue())) reasons.push("2次クレームあり");
    if (isTakenYes() && age !== null && age < 6) reasons.push("服用あり、かつ患者年齢が6歳未満");
    if (isHealthYes()) reasons.push("健康被害あり");

    const uniqueReasons = Array.from(new Set(reasons));
    return {
      isUrgent: uniqueReasons.length > 0,
      reasons: uniqueReasons
    };
  }

  function getMentionText() {
    const info = lookupStoreInfo();
    const urgency = computeUrgency();
    const mentions = [`@PSV（${info.psv_name}）`, "@営業部長", "@統括部長"];
    if (urgency.isUrgent) mentions.push("@リスク担当");
    return mentions.join(" ");
  }

  function row(label, value) {
    const text = String(value == null || value === "" ? "なし" : value);
    return { label, value: text };
  }

  function rowIfAnswered(key, labelOverride) {
    if (!hasAnswer(key)) return null;
    return row(labelOverride || QUESTION_LABELS[key] || key, answerText(key));
  }

  function compactRows(rows) {
    return rows.filter(Boolean).filter((item) => item.value !== "なし" || item.label === QUESTION_LABELS.supplement);
  }

  function buildReportSections() {
    const info = lookupStoreInfo();
    const urgency = computeUrgency();
    const healthDetail = state.answers.health_detail || state.answers.urgent_health_detail || "";
    const takenValue = state.answers.taken || state.answers.urgent_taken || "";
    const healthValue = state.answers.health || state.answers.urgent_health || "";

    const sections = [
      {
        title: "受付情報",
        rows: compactRows([
          row("受付番号", state.completedId || "未確定"),
          row("起票日時", formatDateTime(state.startedAt)),
          row("Slackチャンネル", "#ホットライン報告"),
          row("メンション", getMentionText())
        ])
      },
      {
        title: "速報判断",
        highlight: urgency.isUrgent,
        rows: compactRows([
          row("速報区分", urgency.isUrgent ? "速報対象" : "通常報告"),
          row("速報理由", urgency.reasons.length ? urgency.reasons.join(" / ") : "該当なし"),
          rowIfAnswered("facility_homecare", "施設在宅関与"),
          rowIfAnswered("facility_name", "施設名"),
          rowIfAnswered("urgent_narcotic_related", "麻薬・覚醒剤原料の関与"),
          rowIfAnswered("urgent_external_contact", "保健所等社外対応"),
          hasAnswer("secondary_complaint") ? row("2次クレーム", answerText("secondary_complaint")) : rowIfAnswered("urgent_secondary_complaint", "2次クレーム"),
          takenValue ? row("服用の有無", takenValue) : null,
          healthValue ? row("健康被害", healthValue) : null,
          healthDetail ? row("健康被害の内容", healthDetail) : null,
          rowIfAnswered("urgent_hospitalized", "入院の有無")
        ])
      },
      {
        title: "店舗情報",
        rows: compactRows([
          rowIfAnswered("headquarter"),
          rowIfAnswered("store_code"),
          rowIfAnswered("store_name"),
          row("営業部", info.sales_department),
          row("地区名", info.district),
          row("PSV名", info.psv_name)
        ])
      },
      {
        title: "分類・患者情報",
        rows: compactRows([
          rowIfAnswered("category"),
          rowIfAnswered("mistake_type"),
          rowIfAnswered("medical_institution"),
          rowIfAnswered("dose_date"),
          rowIfAnswered("occurrence_date"),
          rowIfAnswered("occurrence_datetime"),
          rowIfAnswered("discovery_date"),
          rowIfAnswered("patient_type"),
          rowIfAnswered("patient_gender"),
          rowIfAnswered("patient_age")
        ])
      },
      {
        title: "事案内容",
        rows: compactRows([
          rowIfAnswered("true_false_info"),
          rowIfAnswered("input_error"),
          rowIfAnswered("taken"),
          rowIfAnswered("taken_count"),
          rowIfAnswered("health"),
          rowIfAnswered("health_detail"),
          rowIfAnswered("finder"),
          rowIfAnswered("discovery_detail"),
          rowIfAnswered("patient_reaction"),
          rowIfAnswered("leaked_document"),
          rowIfAnswered("privacy_who_to_whom"),
          rowIfAnswered("controlled_class"),
          rowIfAnswered("controlled_medicine_name"),
          rowIfAnswered("controlled_lost_qty"),
          rowIfAnswered("incident_summary"),
          rowIfAnswered("incident_detail")
        ])
      },
      {
        title: "対応状況",
        rows: compactRows([
          rowIfAnswered("medical_report"),
          rowIfAnswered("patient_action_detail"),
          rowIfAnswered("recovery_action"),
          rowIfAnswered("leak_destination_action"),
          rowIfAnswered("controlled_search_detail"),
          rowIfAnswered("post_incident_action"),
          rowIfAnswered("external_action_detail"),
          rowIfAnswered("secondary_complaint")
        ])
      },
      {
        title: "補足",
        rows: compactRows([
          rowIfAnswered("supplement")
        ])
      }
    ];

    return sections.filter((section) => section.rows.length > 0);
  }

  function buildSlackPreviewText() {
    const sections = buildReportSections();
    return sections.map((section) => {
      const body = section.rows.map((item) => `・${item.label}：${item.value}`).join("\n");
      return `【${section.title}】\n${body}`;
    }).join("\n\n");
  }

  function renderSlackPreviewHtml() {
    const urgency = computeUrgency();
    const sections = buildReportSections();
    const bannerClass = urgency.isUrgent ? "slack-banner urgent" : "slack-banner normal";
    const bannerText = urgency.isUrgent
      ? `速報対象：${urgency.reasons.join(" / ")}`
      : "通常報告：速報条件への該当なし";

    const sectionHtml = sections.map((section) => {
      const rows = section.rows.map((item) => `
        <div class="slack-row">
          <div class="slack-label">${escapeHtml(item.label)}</div>
          <div class="slack-value">${escapeHtml(item.value)}</div>
        </div>
      `).join("");
      const sectionClass = section.highlight ? "slack-section section-highlight" : "slack-section";
      return `
        <section class="${sectionClass}">
          <h3>${escapeHtml(section.title)}</h3>
          <div class="slack-rows">${rows}</div>
        </section>
      `;
    }).join("");

    return `
      <div class="slack-preview" aria-label="Slack投稿プレビュー">
        <div class="slack-top">
          <span class="slack-channel">#ホットライン報告</span>
          <span class="slack-mentions">${escapeHtml(getMentionText())}</span>
        </div>
        <div class="${bannerClass}">${escapeHtml(bannerText)}</div>
        ${sectionHtml}
      </div>
    `;
  }

  function renderMessages() {
    chatLog.innerHTML = "";
    state.messages.forEach((message) => {
      const rowEl = document.createElement("div");
      rowEl.className = `message-row ${message.role}`;

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = message.role === "bot" ? "AI" : "私";

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const mainText = escapeHtml(message.text).replace(/\n/g, "<br>");
      const smallText = message.small ? escapeHtml(message.small).replace(/\n/g, "<br>") : "";
      bubble.innerHTML = `<p>${mainText}</p>${smallText ? `<p class="small">${smallText}</p>` : ""}`;

      rowEl.appendChild(avatar);
      rowEl.appendChild(bubble);
      chatLog.appendChild(rowEl);
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderVoiceControls(q) {
    const supported = isSpeechSupported();
    const mode = q.type === "choice" ? "choice" : "dictation";
    const activeForThisQuestion = state.voice.targetKey === q.key;
    const listening = activeForThisQuestion && state.voice.listening;
    const label = q.type === "choice" ? "音声で選択する" : "音声で入力する";
    const title = supported ? label : "このブラウザでは音声入力を利用できません";

    return `
      <div class="voice-compact">
        <button id="voiceStartButton" class="mic-button${listening ? " is-listening" : ""}" type="button" data-voice-mode="${escapeHtml(mode)}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"${supported ? "" : " disabled"} aria-pressed="${listening ? "true" : "false"}">🎙</button>
      </div>
    `;
  }

  function renderVoiceFeedback(q) {
    const activeForThisQuestion = state.voice.targetKey === q.key;
    if (!activeForThisQuestion) return "";

    const message = state.voice.message || "";
    const transcript = state.voice.transcript || "";
    const error = state.voice.error || "";

    if (!message && !transcript && !error) return "";

    return `
      <div class="voice-feedback">
        ${message ? `<p class="voice-status">${escapeHtml(message)}</p>` : ""}
        ${transcript ? `<p class="voice-transcript">聞き取り：${escapeHtml(transcript)}</p>` : ""}
        ${error ? `<p class="voice-error" role="alert">${escapeHtml(error)}</p>` : ""}
      </div>
    `;
  }

  function renderQuestionHeading(q, voiceHtml, voiceFeedbackHtml) {
    return `
      <div class="question-heading-row">
        <div class="question-heading-main">
          <h2 class="question-title">${escapeHtml(q.label)}</h2>
          <p class="question-help">${escapeHtml(q.help || (q.type === "choice" ? "選択してください。" : "入力してください。"))}</p>
        </div>
        ${voiceHtml}
      </div>
      ${voiceFeedbackHtml}
    `;
  }

  function renderQuestionPanel() {
    const q = getQuestion(state.currentKey);
    if (!q) return "";

    const draftValue = state.drafts[q.key] !== undefined ? state.drafts[q.key] : "";
    const answeredValue = hasAnswer(q.key) ? answerText(q.key) : "";
    const initialTextValue = draftValue || (answeredValue === "なし" ? "" : answeredValue);
    const valueAttr = q.type === "text" ? ` value="${escapeHtml(initialTextValue)}"` : "";
    const errorHtml = state.error ? `<div class="error-box" role="alert">${escapeHtml(state.error)}</div>` : "";
    const voiceHtml = renderVoiceControls(q);
    const voiceFeedbackHtml = renderVoiceFeedback(q);
    const headingHtml = renderQuestionHeading(q, voiceHtml, voiceFeedbackHtml);

    if (q.type === "choice" && q.isDateQuestion) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
      const buttons = q.choices.map((choice) => {
        const match = choice.match(/(\d{4}\/\d{2}\/\d{2})/);
        const value = match ? match[1] : choice;
        return `<button class="choice-button" type="button" data-choice="${escapeHtml(value)}">${escapeHtml(choice)}</button>`;
      }).join("");
      return `
        ${headingHtml}
        <div class="date-picker-section">
          <span class="date-picker-label">カレンダーから選択</span>
          <div class="date-picker-row">
            <input type="date" id="datePickerInput" class="date-picker-input" max="${todayStr}" />
            <button id="datePickerSubmit" class="secondary-button date-picker-button" type="button">決定</button>
          </div>
        </div>
        <p class="date-divider-text">または下の一覧から選択</p>
        <div class="choice-grid">${buttons}</div>
        ${errorHtml}
      `;
    }

    if (q.type === "choice") {
      const buttons = q.choices.map((choice) => {
        return `<button class="choice-button" type="button" data-choice="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`;
      }).join("");
      return `
        ${headingHtml}
        <div class="choice-grid">${buttons}</div>
        ${errorHtml}
      `;
    }

    if (q.type === "textarea") {
      return `
        ${headingHtml}
        <div class="input-stack">
          <textarea id="answerInput" class="textarea-input" placeholder="${escapeHtml(q.placeholder || "入力してください")}">${escapeHtml(initialTextValue)}</textarea>
          <div class="input-example">${escapeHtml(q.placeholder || "")}</div>
          <button id="submitTextButton" class="primary-button" type="button">入力した内容で次へ進む</button>
          ${q.optional ? `<button id="skipOptionalButton" class="secondary-button" type="button">補足なしで進む</button>` : ""}
        </div>
        ${errorHtml}
      `;
    }

    return `
      ${headingHtml}
      <div class="input-stack">
        <input id="answerInput" class="text-input" type="text" inputmode="${escapeHtml(q.inputMode || "text")}" maxlength="${escapeHtml(q.maxLength || 200)}" placeholder="${escapeHtml(q.placeholder || "入力してください")}"${valueAttr} />
        <div class="input-example">${escapeHtml(q.placeholder || "")}</div>
        <button id="submitTextButton" class="primary-button" type="button">入力した内容で次へ進む</button>
      </div>
      ${errorHtml}
    `;
  }

  function renderSummaryPanel() {
    const pending = state.pendingSummary;
    if (!pending) return "";
    return `
      <h2 class="question-title">AI要約の確認</h2>
      <p class="question-help">内容を確認して、記録に使う文を選んでください。</p>
      <div class="summary-box">
        <p class="summary-title">要約案</p>
        <p class="summary-text">${escapeHtml(pending.summary)}</p>
        <button class="primary-button" type="button" data-summary-action="adopt">この要約を採用する</button>
        <button class="secondary-button" type="button" data-summary-action="original">元の文章のまま使う</button>
        <button class="secondary-button" type="button" data-summary-action="rewrite">もう一度書き直す</button>
      </div>
    `;
  }

  function renderConfirmPanel() {
    const rows = makeQuestions().filter((q) => hasAnswer(q.key)).map((q) => {
      return `
        <div class="confirm-row">
          <div class="confirm-label">${escapeHtml(q.label)}</div>
          <div class="confirm-value">${escapeHtml(answerText(q.key))}</div>
          <button class="confirm-edit-button" type="button" data-edit-key="${escapeHtml(q.key)}">修正する</button>
        </div>
      `;
    }).join("");

    const info = lookupStoreInfo();

    return `
      <h2 class="question-title">送信前の確認</h2>
      <p class="question-help">内容を確認してください。修正は項目ごとにできます。</p>
      <div class="auto-info-box">
        <p><strong>店番連動の担当情報</strong></p>
        <p>営業部：${escapeHtml(info.sales_department)} ／ 地区名：${escapeHtml(info.district)} ／ PSV名：${escapeHtml(info.psv_name)}</p>
      </div>
      <div class="confirm-list">${rows}</div>
      <div class="preview-wrapper">
        <p class="summary-title">Slack投稿プレビュー</p>
        ${renderSlackPreviewHtml()}
      </div>
      <div class="confirm-actions">
        <button id="finalSubmitButton" class="primary-button" type="button">この内容でホットラインへ共有する</button>
        <button id="confirmEditButton" class="secondary-button" type="button">修正する項目を選ぶ</button>
      </div>
    `;
  }

  function renderEditSelectPanel() {
    const rows = makeQuestions().filter((q) => hasAnswer(q.key)).map((q) => {
      return `<button class="edit-item" type="button" data-edit-key="${escapeHtml(q.key)}">${escapeHtml(q.label)}<small>${escapeHtml(answerText(q.key))}</small></button>`;
    }).join("");

    return `
      <h2 class="question-title">修正する項目を選んでください</h2>
      <p class="question-help">直したい項目だけ選べます。共通情報は保持されます。</p>
      <div class="edit-list">${rows}</div>
    `;
  }

  function renderCompletePanel() {
    const logCount = loadLogs().length;
    const attachedInfo = state.attachedFiles.length > 0
      ? `<p>添付ファイル：${escapeHtml(state.attachedFiles.join("、"))}</p>`
      : "";
    return `
      <h2 class="question-title">受付完了</h2>
      <div class="complete-box">
        <p class="complete-id">受付番号：${escapeHtml(state.completedId)}</p>
        <p>Slack通知：モック完了</p>
        <p>管理表転記：モック完了</p>
        ${attachedInfo}
        <p>次に、PSVまたは営業部長からの電話連絡をお待ちください。対応が完了したらPSVへ完了連絡をお願いします。</p>
      </div>
      <button id="downloadLogFromCompleteButton" class="log-download-button" type="button">
        回答ログをダウンロード（JSON）<span class="log-count-badge">${logCount}件</span>
      </button>
      <div class="preview-wrapper complete-preview">
        <p class="summary-title">Slack投稿プレビュー</p>
        ${renderSlackPreviewHtml()}
        <details class="slack-plain-details">
          <summary>Slackテキスト形式で確認する</summary>
          <pre>${escapeHtml(buildSlackPreviewText())}</pre>
        </details>
      </div>
      <button id="restartButton" class="secondary-button restart-button" type="button">新しい報告を開始する</button>
    `;
  }

  function progressLabel() {
    if (state.mode === "summary") return "AI要約の確認";
    if (state.mode === "confirm") return "送信前の確認";
    if (state.mode === "editSelect") return "修正項目の選択";
    if (state.mode === "complete") return "受付完了";

    const questions = makeQuestions();
    const index = questions.findIndex((q) => q.key === state.currentKey);
    if (index < 0) return "質問中";
    return `${index + 1} / ${questions.length}`;
  }

  function renderPanel() {
    if (state.mode === "summary") questionArea.innerHTML = renderSummaryPanel();
    else if (state.mode === "confirm") questionArea.innerHTML = renderConfirmPanel();
    else if (state.mode === "editSelect") questionArea.innerHTML = renderEditSelectPanel();
    else if (state.mode === "complete") questionArea.innerHTML = renderCompletePanel();
    else questionArea.innerHTML = renderQuestionPanel();

    progressText.textContent = progressLabel();
    editButton.disabled = makeQuestions().filter((q) => hasAnswer(q.key)).length === 0 || state.mode === "editSelect" || state.mode === "complete";

    bindPanelEvents();
  }

  function bindPanelEvents() {
    questionArea.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => submitAnswer(button.getAttribute("data-choice")));
    });

    const datePickerSubmit = document.getElementById("datePickerSubmit");
    if (datePickerSubmit) {
      datePickerSubmit.addEventListener("click", () => {
        const dateInput = document.getElementById("datePickerInput");
        if (dateInput && dateInput.value) {
          const [year, month, day] = dateInput.value.split("-");
          submitAnswer(`${year}/${month}/${day}`);
        } else {
          state.error = "日付を選択してください。";
          render();
        }
      });
    }

    const submitTextButton = document.getElementById("submitTextButton");
    const answerInput = document.getElementById("answerInput");
    if (submitTextButton && answerInput) {
      answerInput.addEventListener("input", () => {
        if (state.currentKey) state.drafts[state.currentKey] = answerInput.value;
      });
      submitTextButton.addEventListener("click", () => submitAnswer(answerInput.value));
      answerInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && answerInput.tagName !== "TEXTAREA") {
          event.preventDefault();
          submitAnswer(answerInput.value);
        }
      });
      if (window.matchMedia("(min-width: 721px)").matches) {
        setTimeout(() => answerInput.focus(), 0);
      }
    }

    const skipOptionalButton = document.getElementById("skipOptionalButton");
    if (skipOptionalButton) {
      skipOptionalButton.addEventListener("click", () => submitAnswer(""));
    }

    const voiceStartButton = document.getElementById("voiceStartButton");
    if (voiceStartButton) {
      voiceStartButton.addEventListener("click", () => {
        const q = getQuestion(state.currentKey);
        const listeningForCurrentQuestion = q && state.voice.listening && state.voice.targetKey === q.key;
        if (listeningForCurrentQuestion) {
          stopVoiceRecognition();
          state.voice.listening = false;
          state.voice.message = "音声入力を停止しました。";
          render();
          return;
        }
        startVoice(voiceStartButton.getAttribute("data-voice-mode"));
      });
    }

    questionArea.querySelectorAll("[data-summary-action]").forEach((button) => {
      button.addEventListener("click", () => chooseSummary(button.getAttribute("data-summary-action")));
    });

    questionArea.querySelectorAll("[data-edit-key]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!state.editReturn) {
          state.editReturn = { mode: state.mode, currentKey: state.currentKey };
        }
        selectEditKey(button.getAttribute("data-edit-key"));
      });
    });

    const finalSubmitButton = document.getElementById("finalSubmitButton");
    if (finalSubmitButton) finalSubmitButton.addEventListener("click", submitFinal);

    const confirmEditButton = document.getElementById("confirmEditButton");
    if (confirmEditButton) confirmEditButton.addEventListener("click", () => beginEdit("confirm"));

    const restartButton = document.getElementById("restartButton");
    if (restartButton) restartButton.addEventListener("click", resetApp);

    const downloadLogFromCompleteButton = document.getElementById("downloadLogFromCompleteButton");
    if (downloadLogFromCompleteButton) downloadLogFromCompleteButton.addEventListener("click", downloadLogs);
  }

  function render() {
    renderMessages();
    renderPanel();
  }

  /* ── フォントサイズ管理 ── */
  function applyFontSize(index) {
    FONT_SIZES.forEach((f) => document.body.classList.remove(f.cls));
    document.body.classList.remove("large-text");
    if (index !== FONT_DEFAULT_INDEX) {
      document.body.classList.add(FONT_SIZES[index].cls);
    }
    fontButton.textContent = `文字：${FONT_SIZES[index].label}`;
    try { localStorage.setItem("hl_font_size_index", String(index)); } catch { /* ignore */ }
  }

  fontButton.addEventListener("click", () => {
    fontSizeIndex = (fontSizeIndex + 1) % FONT_SIZES.length;
    applyFontSize(fontSizeIndex);
  });

  /* ── ファイル添付 ── */
  function renderAttachedFiles() {
    const list = document.getElementById("attachedFilesList");
    if (!list) return;
    list.innerHTML = state.attachedFiles.map((name, i) => `
      <span class="attached-file-chip" title="${escapeHtml(name)}">
        ${escapeHtml(name.length > 20 ? name.slice(0, 18) + "…" : name)}
        <button class="attached-file-remove" type="button" data-file-index="${i}" aria-label="${escapeHtml(name)}を削除">✕</button>
      </span>
    `).join("");
    list.querySelectorAll("[data-file-index]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-file-index"), 10);
        state.attachedFiles.splice(idx, 1);
        renderAttachedFiles();
      });
    });
  }

  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      Array.from(fileInput.files).forEach((file) => {
        if (!state.attachedFiles.includes(file.name)) {
          state.attachedFiles.push(file.name);
        }
      });
      fileInput.value = "";
      renderAttachedFiles();
    });
  }

  /* ── リサイズハンドル（モバイル上下比率調整）── */
  function initResizeHandle() {
    const handle = document.getElementById("resizeHandle");
    const chatWindow = document.querySelector(".chat-window");
    if (!handle || !chatWindow) return;

    let dragging = false;
    let startY = 0;
    let startTopPx = 0;

    handle.addEventListener("touchstart", (e) => {
      if (window.innerWidth >= 960) return;
      dragging = true;
      startY = e.touches[0].clientY;
      const botArea = chatWindow.querySelector(".bot-area");
      startTopPx = botArea ? botArea.offsetHeight : chatWindow.offsetHeight * 0.52;
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const dy = e.touches[0].clientY - startY;
      const handleH = handle.offsetHeight || 20;
      const total = chatWindow.offsetHeight - handleH;
      const newTop = Math.min(total * 0.80, Math.max(total * 0.20, startTopPx + dy));
      const newBottom = total - newTop;
      chatWindow.style.gridTemplateRows = `${newTop}px ${handleH}px ${newBottom}px`;
    }, { passive: false });

    window.addEventListener("touchend", () => { dragging = false; });

    handle.addEventListener("keydown", (e) => {
      if (window.innerWidth >= 960) return;
      const step = 20;
      const handleH = handle.offsetHeight || 20;
      const total = chatWindow.offsetHeight - handleH;
      const botArea = chatWindow.querySelector(".bot-area");
      const currentTop = botArea ? botArea.offsetHeight : total * 0.52;
      let newTop = currentTop;
      if (e.key === "ArrowUp") newTop = Math.max(total * 0.20, currentTop - step);
      if (e.key === "ArrowDown") newTop = Math.min(total * 0.80, currentTop + step);
      if (newTop !== currentTop) {
        e.preventDefault();
        chatWindow.style.gridTemplateRows = `${newTop}px ${handleH}px ${total - newTop}px`;
      }
    });
  }

  editButton.addEventListener("click", () => beginEdit());
  phoneButton.addEventListener("click", phoneFallback);
  resetButton.addEventListener("click", () => {
    const ok = window.confirm("入力中の内容を消して、最初からやり直しますか？");
    if (ok) resetApp();
  });
  if (downloadLogButton) downloadLogButton.addEventListener("click", downloadLogs);

  applyFontSize(fontSizeIndex);
  initResizeHandle();
  bindViewportGuards();
  resetApp();
})();
