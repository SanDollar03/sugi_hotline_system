(function () {
  "use strict";

  const CATEGORY_OPTIONS = [
    "調剤ミス",
    "個人情報漏洩",
    "管理薬剤の紛失",
    "クレーム",
    "事故",
    "法令遵守違反",
    "その他"
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

  const AGE_GROUPS = [
    "10歳未満", "10代", "20代", "30代", "40代", "50代", "60代", "70代", "80代以上", "不明"
  ];

  const PATIENT_REACTIONS = ["お怒り", "体調不良", "不安", "問題なし", "未接触", "不明"];
  const DISCOVERY_ROUTES = ["薬局内で発見", "患者様から", "医療機関から", "本部・他部署から", "その他", "不明"];
  const ACTION_STATUSES = ["未対応", "対応中", "対応予定あり", "対応済み"];

  const state = {
    answers: {},
    messages: [],
    currentKey: null,
    mode: "question",
    pendingSummary: null,
    editReturn: null,
    error: "",
    startedAt: new Date(),
    completedId: ""
  };

  const chatLog = document.getElementById("chatLog");
  const questionArea = document.getElementById("questionArea");
  const progressText = document.getElementById("progressText");
  const editButton = document.getElementById("editButton");
  const phoneButton = document.getElementById("phoneButton");
  const fontButton = document.getElementById("fontButton");
  const resetButton = document.getElementById("resetButton");

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
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
    return state.answers.category === "調剤ミス";
  }

  function isControlledLoss() {
    return state.answers.category === "管理薬剤の紛失";
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

  function makeQuestions() {
    const dateOptions = recentDateOptions();
    return [
      {
        key: "category",
        label: "分類",
        type: "choice",
        choices: CATEGORY_OPTIONS,
        bot: "まず、今回の内容に近い分類を選んでください。AIは重大度を判定しません。すべてホットラインへ共有され、人が確認します。",
        help: "迷う場合は、いちばん近いものを選んでください。最後に修正できます。"
      },
      {
        key: "mistake_type",
        label: "ミスの種類",
        type: "choice",
        choices: MISTAKE_TYPES,
        condition: () => isDispensing(),
        bot: "調剤ミスの種類を選びましょう。分からない場合は「その他」で進められます。",
        help: "この選択に合わせて、後の質問を自動で調整します。"
      },
      {
        key: "store_code",
        label: "店番",
        type: "text",
        inputMode: "numeric",
        maxLength: 6,
        bot: "次に、店舗を確認します。店番を6桁の数字で入力してください。",
        placeholder: "例：000769",
        help: "6桁の数字のみです。ハイフンや店舗名は入れないでください。",
        validate: (value) => /^\d{6}$/.test(value.trim()) ? "" : "店番は6桁の数字で入力してください。例：000769"
      },
      {
        key: "store_name",
        label: "店舗名",
        type: "text",
        bot: "店舗名を入力してください。店番と店舗名の両方を記録します。",
        placeholder: "例：〇〇薬局 〇〇店",
        help: "正式名称が分からない場合は、普段使っている店舗名で大丈夫です。"
      },
      {
        key: "medical_institution",
        label: "医療機関名",
        type: "text",
        condition: () => isDispensing(),
        bot: "処方元の医療機関名を入力してください。",
        placeholder: "例：〇〇クリニック",
        help: "分かる範囲で入力してください。"
      },
      {
        key: "dose_date",
        label: "投薬日",
        type: "choice",
        choices: dateOptions,
        condition: () => isDispensing(),
        bot: "投薬日を選んでください。正確でなくても、分かる範囲で大丈夫です。",
        help: "一覧にない場合は「それ以前」または「不明」を選べます。"
      },
      {
        key: "discovery_date",
        label: "発覚日",
        type: "choice",
        choices: dateOptions,
        bot: "発覚日を選んでください。",
        help: "報告時点で分かる範囲で選んでください。"
      },
      {
        key: "patient_type",
        label: "新患/既患",
        type: "choice",
        choices: ["新患（初めて）", "既患", "不明"],
        condition: () => isDispensing(),
        bot: "患者様は新患か既患かを選んでください。",
        help: "分からない場合は「不明」で進められます。"
      },
      {
        key: "age_group",
        label: "年齢層",
        type: "choice",
        choices: AGE_GROUPS,
        condition: () => isDispensing(),
        bot: "患者様の年齢層を選んでください。",
        help: "個人を特定できる情報は、必要以上に入力しないでください。"
      },
      {
        key: "true_false_info",
        label: "正誤情報",
        type: "textarea",
        condition: () => isDispensing(),
        bot: () => trueFalsePrompt(),
        placeholder: "例：正しくはA薬10mg、実際はA薬5mgをお渡しした。数量は14錠のところ7錠だった。",
        help: "文章が整っていなくても大丈夫です。必要に応じてAIが要約確認します。",
        summarize: () => state.answers.mistake_type === "疑義照会漏れ"
      },
      {
        key: "taken",
        label: "服用の有無",
        type: "choice",
        choices: ["服用した", "服用していない", "不明"],
        condition: () => isDispensing(),
        bot: "患者様が実際に服用したかを選んでください。",
        help: "分からない場合は「不明」で進めてください。"
      },
      {
        key: "taken_count",
        label: "服用回数",
        type: "text",
        condition: () => isDispensing() && state.answers.taken === "服用した",
        bot: "服用した回数や日数を、分かる範囲で入力してください。",
        placeholder: "例：1回のみ、朝夕2回、3日分など",
        help: "正確な回数が不明な場合は「不明」と入力できます。"
      },
      {
        key: "health",
        label: "健康被害",
        type: "choice",
        choices: ["あり（症状あり）", "なし", "不明"],
        condition: () => isDispensing(),
        bot: "健康被害や症状の有無を選んでください。AIは判断せず、そのままホットラインへ共有します。",
        help: "判断に迷う場合は「不明」で進めてください。"
      },
      {
        key: "health_detail",
        label: "症状詳細",
        type: "textarea",
        condition: () => isDispensing() && state.answers.health === "あり（症状あり）",
        bot: "症状について、聞いている範囲で入力してください。後でAIが短く整理します。",
        placeholder: "例：服用後にめまいを訴えた。現在は自宅で様子を見ている。受診予定は未確認。",
        help: "診断や判断ではなく、確認できている事実だけで大丈夫です。",
        summarize: () => true
      },
      {
        key: "patient_reaction",
        label: "患者様の状態・反応",
        type: "choice",
        choices: PATIENT_REACTIONS,
        condition: () => !isControlledLoss(),
        bot: "患者様の現在の状態や反応に近いものを選んでください。",
        help: "管理薬剤の紛失では、この質問は自動的に省略されます。"
      },
      {
        key: "privacy_type",
        label: "漏洩した情報の種類",
        type: "choice",
        choices: ["処方せん", "お薬手帳", "薬袋・薬情", "会計情報", "患者情報の口頭漏洩", "その他", "不明"],
        condition: () => state.answers.category === "個人情報漏洩",
        bot: "漏洩した可能性がある情報の種類を選んでください。",
        help: "複数ある場合は、主なものを選び、次の欄に補足してください。"
      },
      {
        key: "privacy_detail",
        label: "個人情報漏洩の詳細",
        type: "textarea",
        condition: () => state.answers.category === "個人情報漏洩",
        bot: "どのような状況だったかを入力してください。AIが短く整理して確認します。",
        placeholder: "例：A様に渡す予定のお薬手帳を、誤ってB様に渡した可能性がある。現在回収確認中。",
        help: "分かる範囲で、事実をそのまま入力してください。",
        summarize: () => true
      },
      {
        key: "privacy_recovery",
        label: "回収状況",
        type: "choice",
        choices: ["回収済み", "回収中", "未回収", "回収不要", "不明"],
        condition: () => state.answers.category === "個人情報漏洩",
        bot: "漏洩した資料などの回収状況を選んでください。",
        help: "現時点の状況で大丈夫です。"
      },
      {
        key: "controlled_type",
        label: "薬剤の種類",
        type: "choice",
        choices: ["麻薬", "覚醒剤原料", "向精神薬", "毒薬・劇薬", "その他管理薬剤", "不明"],
        condition: () => state.answers.category === "管理薬剤の紛失",
        bot: "紛失した管理薬剤の種類を選んでください。",
        help: "分類が分からない場合は「不明」で進めてください。"
      },
      {
        key: "controlled_name_qty",
        label: "薬剤名と数量",
        type: "textarea",
        condition: () => state.answers.category === "管理薬剤の紛失",
        bot: "薬剤名と数量を、分かる範囲で入力してください。",
        placeholder: "例：〇〇錠 10錠、数量確認中など",
        help: "不明点は不明のままで構いません。"
      },
      {
        key: "controlled_search",
        label: "捜索状況",
        type: "choice",
        choices: ["捜索中", "発見済み", "未捜索", "警察・行政へ相談済み", "不明"],
        condition: () => state.answers.category === "管理薬剤の紛失",
        bot: "現時点の捜索状況を選んでください。",
        help: "対応途中でも問題ありません。"
      },
      {
        key: "complaint_type",
        label: "クレーム分類",
        type: "choice",
        choices: ["接遇", "待ち時間", "説明内容", "会計", "商品・在庫", "その他", "不明"],
        condition: () => state.answers.category === "クレーム",
        bot: "クレーム内容に近い分類を選んでください。",
        help: "迷う場合は「その他」または「不明」で進められます。"
      },
      {
        key: "complaint_detail",
        label: "クレーム内容",
        type: "textarea",
        condition: () => state.answers.category === "クレーム",
        bot: "クレーム内容を入力してください。AIが短く整理して確認します。",
        placeholder: "例：待ち時間が長いことについてお怒り。説明を求められている。",
        help: "発言を完全に再現しなくても、要点で大丈夫です。",
        summarize: () => true
      },
      {
        key: "complaint_risk",
        label: "二次クレーム発展リスク",
        type: "choice",
        choices: ["高い", "ありそう", "低い", "不明"],
        condition: () => state.answers.category === "クレーム",
        bot: "二次クレームに発展しそうか、現場感に近いものを選んでください。",
        help: "これはAI判定ではなく、現時点の状況共有です。"
      },
      {
        key: "accident_type",
        label: "事故の種類",
        type: "choice",
        choices: ["車両事故", "針刺し事故", "転倒・転落", "設備事故", "その他", "不明"],
        condition: () => state.answers.category === "事故",
        bot: "事故の種類を選んでください。",
        help: "近いものを選んでください。"
      },
      {
        key: "injury",
        label: "けが人の有無",
        type: "choice",
        choices: ["あり", "なし", "不明"],
        condition: () => state.answers.category === "事故",
        bot: "けが人の有無を選んでください。",
        help: "判断が難しい場合は「不明」で進めてください。"
      },
      {
        key: "accident_detail",
        label: "事故の概要",
        type: "textarea",
        condition: () => state.answers.category === "事故",
        bot: "事故の概要を入力してください。AIが短く整理して確認します。",
        placeholder: "例：店舗駐車場で車両接触が発生。けが人は確認中。警察連絡は未実施。",
        help: "分かっている事実だけを入力してください。",
        summarize: () => true
      },
      {
        key: "violation_type",
        label: "違反の種類",
        type: "choice",
        choices: ["法令違反の疑い", "偽造処方せん", "記録不備", "個別指導・行政関連", "その他", "不明"],
        condition: () => state.answers.category === "法令遵守違反",
        bot: "法令遵守違反に関する種類を選んでください。",
        help: "AIは違反かどうかを判定しません。ホットライン担当が確認します。"
      },
      {
        key: "violation_detail",
        label: "法令違反内容",
        type: "textarea",
        condition: () => state.answers.category === "法令遵守違反",
        bot: "確認できている内容を入力してください。AIが短く整理して確認します。",
        placeholder: "例：偽造処方せんの可能性があり、医療機関へ確認予定。",
        help: "断定せず、確認できている事実を入力してください。",
        summarize: () => true
      },
      {
        key: "other_detail",
        label: "その他状況",
        type: "textarea",
        condition: () => state.answers.category === "その他",
        bot: "状況の概要を入力してください。AIが短く整理して確認します。",
        placeholder: "例：分類に迷う事象が発生。ホットラインへ相談したい。",
        help: "自由に入力できます。分かる範囲で大丈夫です。",
        summarize: () => true
      },
      {
        key: "discovery_route",
        label: "発覚経緯",
        type: "choice",
        choices: DISCOVERY_ROUTES,
        bot: "どのように発覚したかを選んでください。",
        help: "近いものを選んでください。"
      },
      {
        key: "current_action",
        label: "対応状況",
        type: "choice",
        choices: ACTION_STATUSES,
        bot: "現在の対応状況を選んでください。未対応でも問題ありません。",
        help: "この時点の状態をそのまま共有します。"
      },
      {
        key: "action_detail",
        label: "対応内容",
        type: "textarea",
        condition: () => state.answers.current_action && state.answers.current_action !== "未対応",
        bot: "対応内容を入力してください。AIが短く整理して確認します。",
        placeholder: "例：患者様へ電話連絡済み。薬剤回収のため来局を依頼。医師への連絡はこれから。",
        help: "途中経過で大丈夫です。事実だけ入力してください。",
        summarize: () => true
      },
      {
        key: "supplement",
        label: "補足事項",
        type: "textarea",
        optional: true,
        bot: "最後に、他に伝えておきたいことがあれば入力してください。なければ空欄のまま進めます。",
        placeholder: "例：担当者名、折り返し希望時間、追加で気になる点など",
        help: "補足がない場合は「補足なしで進む」を押してください。"
      }
    ].filter((q) => !q.condition || q.condition());
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
      mistake_type: "それはお困りですね。ここから先は、必要なことだけ順番に確認していきます。",
      store_code: "安心してください。店舗の確認から、ゆっくり進めます。",
      store_name: "ありがとうございます。続いて店舗名を確認します。分かる範囲で大丈夫です。",
      medical_institution: "ここも分かる範囲で大丈夫です。処方元の医療機関を確認します。",
      dose_date: "日付は正確でなくても構いません。近いものを選んでください。",
      discovery_date: "大丈夫です。発覚した日を、分かる範囲で選びましょう。",
      patient_type: "患者様について、分かる範囲だけ教えてください。",
      age_group: "個人を特定しすぎない形で確認します。安心してください。",
      true_false_info: "ここは大切な内容ですが、文章を整える必要はありません。あとでAIが読みやすく整理します。",
      taken: "確認できている範囲で大丈夫です。服用の有無を選んでください。",
      taken_count: "それは心配な状況ですね。分かっている回数や日数だけで構いません。",
      health: "安心してください。ここでは判断ではなく、事実として分かる範囲を共有します。",
      health_detail: "それはお困りですね。症状は、聞いている範囲だけで大丈夫です。",
      patient_reaction: "患者様の反応も、現時点で近いものを選べば大丈夫です。",
      privacy_type: "落ち着いて進めましょう。漏洩した可能性がある情報を選んでください。",
      privacy_detail: "不安な状況だと思います。分かる範囲の事実をそのまま入力してください。",
      privacy_recovery: "ありがとうございます。次に、回収できているかを確認します。",
      controlled_type: "管理薬剤の件ですね。慎重に、でも焦らず確認していきます。",
      controlled_name_qty: "安心してください。薬剤名や数量は、分かっている範囲だけで構いません。",
      controlled_search: "現在の捜索状況を共有できれば大丈夫です。",
      complaint_type: "それは対応に困る状況ですね。クレームの種類を一緒に整理しましょう。",
      complaint_detail: "そのままの言葉で大丈夫です。あとでAIが短く読みやすく整理します。",
      complaint_risk: "現場で感じている印象で構いません。近いものを選んでください。",
      accident_type: "事故の内容を確認します。落ち着いて、近いものを選びましょう。",
      injury: "けが人の有無を確認します。不明な場合は不明で大丈夫です。",
      accident_detail: "大変な状況だと思います。分かっている事実だけ入力してください。",
      violation_type: "AIが違反かどうかを決めることはありません。確認できている種類を選んでください。",
      violation_detail: "断定しなくて大丈夫です。確認できている内容だけ共有しましょう。",
      other_detail: "分類に迷う内容でも大丈夫です。相談したい内容をそのまま入力してください。",
      discovery_route: "ありがとうございます。次に、どのように分かったかを確認します。",
      current_action: "未対応でも問題ありません。今の状況をそのまま教えてください。",
      action_detail: "対応途中でも大丈夫です。実施済み・予定していることを分かる範囲で入力してください。",
      supplement: "最後です。気になることがあれば、ここに残せます。なければ空欄で進められます。"
    };
    return leads[key] || "大丈夫です。分かる範囲で、一つずつ確認していきます。";
  }

  function getQuestionText(q) {
    const base = typeof q.bot === "function" ? q.bot() : q.bot;
    const lead = warmLeadForQuestion(q.key);
    return `${lead}
${base}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
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

  function cleanupAfterAnswer(key, newValue, oldValue) {
    if (key === "category" && oldValue !== undefined && oldValue !== newValue) {
      const keep = new Set(["category", "store_code", "store_name"]);
      Object.keys(state.answers).forEach((k) => {
        if (!keep.has(k)) delete state.answers[k];
      });
    }

    if (key === "mistake_type" && oldValue !== undefined && oldValue !== newValue) {
      delete state.answers.true_false_info;
    }

    if (key === "taken" && newValue !== "服用した") {
      delete state.answers.taken_count;
    }

    if (key === "health" && newValue !== "あり（症状あり）") {
      delete state.answers.health_detail;
    }

    if (key === "current_action" && newValue === "未対応") {
      delete state.answers.action_detail;
    }

    const activeKeys = new Set(makeQuestions().map((q) => q.key));
    Object.keys(state.answers).forEach((k) => {
      if (!activeKeys.has(k)) delete state.answers[k];
    });
  }

  function saveAnswer(key, value) {
    const oldValue = state.answers[key];
    state.answers[key] = value;
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
      render();
      return;
    }

    state.error = "";
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
        addMessage("bot", "ありがとうございます。入力していただいた内容を、読みやすいように短く整理しました。この内容で記録してよいか、一緒に確認しましょう。", "安心してください。内容の意味は変えず、言いよどみや冗長な表現だけを整えます。");
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
      state.pendingSummary = null;
      askQuestion(key);
    }
  }

  function showConfirm() {
    state.mode = "confirm";
    state.currentKey = null;
    state.error = "";
    addMessage("bot", "ここまでありがとうございます。最後に入力内容を一緒に確認しましょう。修正したい項目があれば、その項目の「修正する」を押してください。", "安心してください。まだ確定ではありません。最後の青いボタンを押すまで送信扱いにはなりません。");
    render();
  }

  function beginEdit(modeOverride) {
    const answered = makeQuestions().filter((q) => hasAnswer(q.key));
    if (answered.length === 0) return;
    state.editReturn = {
      mode: modeOverride || state.mode,
      currentKey: state.currentKey
    };
    state.mode = "editSelect";
    state.error = "";
    addMessage("bot", "大丈夫です。修正したい項目だけ選んでください。必要なところだけ直せます。", "最初からやり直す必要はありません。ここまでの入力はできるだけ保持します。");
    render();
  }

  function selectEditKey(key) {
    const q = getQuestion(key);
    if (!q) return;
    state.currentKey = key;
    state.mode = "question";
    state.error = "";
    addMessage("bot", `「${q.label}」を修正します。現在の内容は「${answerText(key)}」です。`, "新しい内容を入力または選択してください。");
    render();
  }

  function submitFinal() {
    const reportId = `HL-${formatDate(new Date()).replace(/\//g, "")}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    state.completedId = reportId;
    state.mode = "complete";
    addMessage("user", "この内容でホットラインへ共有します");
    addMessage("bot", "受付しました。ここまで入力していただき、ありがとうございます。プロトタイプのため外部送信はしていませんが、実運用ではSlack通知と管理表転記がここで実行されます。", "安心してください。AIは判定せず、すべて人が確認する前提です。");
    render();
  }

  function phoneFallback() {
    addMessage("bot", "不安な場合は、通常のホットライン電話で相談してください。この画面の入力は途中でも問題ありません。安心してください、電話に切り替えても大丈夫です。", "緊急性がある、判断に迷う、入力が難しい場合は電話を優先してください。入力を完璧に終わらせる必要はありません。");
    render();
  }

  function resetApp() {
    state.answers = {};
    state.messages = [];
    state.currentKey = null;
    state.mode = "question";
    state.pendingSummary = null;
    state.editReturn = null;
    state.error = "";
    state.startedAt = new Date();
    state.completedId = "";

    addMessage("bot", "こんにちは。ご連絡ありがとうございます。急いでいる中でも、ここでは必要な内容を一つずつ一緒に確認していきます。安心してください。", "文章をきれいに書く必要はありません。選ぶだけで進められる項目を多くしています。分からないところは「不明」で進められます。");
    addMessage("bot", "このAIは、重大度やミスレベルを判定しません。すべての報告はホットライン担当へ共有し、人が確認します。", "途中で不安になった場合は、いつでも電話相談に切り替えられます。無理に最後まで入力しなくても大丈夫です。");
    askNext();
  }

  function renderMessages() {
    chatLog.innerHTML = "";
    state.messages.forEach((message) => {
      const row = document.createElement("div");
      row.className = `message-row ${message.role}`;

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = message.role === "bot" ? "AI" : "私";

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      const mainText = escapeHtml(message.text).replace(/\n/g, "<br>");
      const smallText = message.small ? escapeHtml(message.small).replace(/\n/g, "<br>") : "";
      bubble.innerHTML = `<p>${mainText}</p>${smallText ? `<p class="small">${smallText}</p>` : ""}`;

      row.appendChild(avatar);
      row.appendChild(bubble);
      chatLog.appendChild(row);
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderQuestionPanel() {
    const q = getQuestion(state.currentKey);
    if (!q) return "";

    const answeredValue = hasAnswer(q.key) ? answerText(q.key) : "";
    const valueAttr = q.type === "text" ? ` value="${escapeHtml(answeredValue === "なし" ? "" : answeredValue)}"` : "";
    const errorHtml = state.error ? `<div class="error-box" role="alert">${escapeHtml(state.error)}</div>` : "";

    if (q.type === "choice") {
      const buttons = q.choices.map((choice) => {
        return `<button class="choice-button" type="button" data-choice="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`;
      }).join("");
      return `
        <h2 class="question-title">${escapeHtml(q.label)}</h2>
        <p class="question-help">${escapeHtml(q.help || "選択してください。")}</p>
        <div class="choice-grid">${buttons}</div>
        ${errorHtml}
      `;
    }

    if (q.type === "textarea") {
      const initial = hasAnswer(q.key) && state.answers[q.key] !== "" ? escapeHtml(state.answers[q.key]) : "";
      return `
        <h2 class="question-title">${escapeHtml(q.label)}</h2>
        <p class="question-help">${escapeHtml(q.help || "入力してください。")}</p>
        <div class="input-stack">
          <textarea id="answerInput" class="textarea-input" placeholder="${escapeHtml(q.placeholder || "入力してください")}">${initial}</textarea>
          <div class="input-example">${escapeHtml(q.placeholder || "")}</div>
          <button id="submitTextButton" class="primary-button" type="button">入力した内容で次へ進む</button>
          ${q.optional ? `<button id="skipOptionalButton" class="secondary-button" type="button">補足なしで進む</button>` : ""}
        </div>
        ${errorHtml}
      `;
    }

    return `
      <h2 class="question-title">${escapeHtml(q.label)}</h2>
      <p class="question-help">${escapeHtml(q.help || "入力してください。")}</p>
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

    return `
      <h2 class="question-title">送信前の確認</h2>
      <p class="question-help">内容を確認してください。修正は項目ごとにできます。</p>
      <div class="confirm-list">${rows}</div>
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
    const slackPreview = buildSlackPreview();
    return `
      <h2 class="question-title">受付完了</h2>
      <div class="complete-box">
        <p class="complete-id">受付番号：${escapeHtml(state.completedId)}</p>
        <p>Slack通知：モック完了</p>
        <p>管理表転記：モック完了</p>
        <p>次に、PSVまたは営業部長からの電話連絡をお待ちください。対応が完了したらPSVへ完了連絡をお願いします。</p>
      </div>
      <div class="summary-box" style="margin-top: 12px;">
        <p class="summary-title">Slack投稿プレビュー</p>
        <p class="summary-text">${escapeHtml(slackPreview)}</p>
      </div>
      <button id="restartButton" class="secondary-button" type="button" style="margin-top: 12px;">新しい報告を開始する</button>
    `;
  }

  function buildSlackPreview() {
    const rows = makeQuestions().filter((q) => hasAnswer(q.key)).map((q) => `${q.label}: ${answerText(q.key)}`);
    return `#ホットライン報告\n${rows.join("\n")}\n@PSV @営業部長 @統括部長`;
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

    const submitTextButton = document.getElementById("submitTextButton");
    const answerInput = document.getElementById("answerInput");
    if (submitTextButton && answerInput) {
      submitTextButton.addEventListener("click", () => submitAnswer(answerInput.value));
      answerInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && answerInput.tagName !== "TEXTAREA") {
          event.preventDefault();
          submitAnswer(answerInput.value);
        }
      });
      setTimeout(() => answerInput.focus(), 0);
    }

    const skipOptionalButton = document.getElementById("skipOptionalButton");
    if (skipOptionalButton) {
      skipOptionalButton.addEventListener("click", () => submitAnswer(""));
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
  }

  function render() {
    renderMessages();
    renderPanel();
  }

  editButton.addEventListener("click", () => beginEdit());
  phoneButton.addEventListener("click", phoneFallback);
  resetButton.addEventListener("click", () => {
    const ok = window.confirm("入力中の内容を消して、最初からやり直しますか？");
    if (ok) resetApp();
  });
  fontButton.addEventListener("click", () => {
    document.body.classList.toggle("large-text");
    fontButton.textContent = document.body.classList.contains("large-text") ? "標準の文字に戻す" : "文字を大きく";
  });

  resetApp();
})();
