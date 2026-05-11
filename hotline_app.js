(function () {
  'use strict';

  const STORAGE_KEY = 'hotline_ai_agent_v3_state_v1';

  const CATEGORIES = [
    { label: '調剤ミス', value: '調剤ミス', sub: '薬の間違い・数量間違い・渡し忘れなど' },
    { label: '個人情報漏洩', value: '個人情報漏洩', sub: '処方せん・お薬手帳・明細書の渡し間違いなど' },
    { label: '管理薬剤の紛失', value: '管理薬剤の紛失', sub: '麻薬・覚醒剤原料・向精神薬など' },
    { label: 'クレーム', value: 'クレーム', sub: '患者様・ご家族・医療機関からの苦情' },
    { label: '事故', value: '事故', sub: '車両事故・針刺し事故・転倒など' },
    { label: '法令遵守違反', value: '法令遵守違反', sub: '法令違反・偽造処方せん・記録不備など' },
    { label: 'その他', value: 'その他', sub: '上記に当てはまらない相談' }
  ];

  const ERROR_TYPES = [
    '疑義照会漏れ',
    '規格間違い',
    '数量間違い／ピッキング数間違い',
    '用量間違い',
    '用法間違い',
    '渡し忘れ',
    '分包ミス',
    '異薬異物混入',
    '入力間違い／漏れ',
    '薬剤名称／変更間違い',
    '剤形間違い',
    '別患者への投薬',
    'カレンダーセット間違い',
    'その他'
  ];

  const AGE_GROUPS = ['10歳未満', '10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代以上', '不明'];
  const PATIENT_REACTIONS = ['お怒り', '体調不良', '不安', '問題なし', '未接触', '不明'];
  const DISCOVERY_ROUTES = ['薬局内で発見', '患者様から連絡', '医療機関から連絡', '本部・PSVから連絡', 'その他', '不明'];
  const ACTION_STATUS = ['未対応', '対応中', '対応予定あり', '対応済み'];

  const SHEET_COLUMNS = [
    'No.', '起票日', '時刻', '店番', '店名', '医療機関名', '投薬日', '発覚日',
    '新患/既患', '年齢層', '分類', 'ミスレベル', '正/誤', '服用有無', '服用回数',
    '健康被害', '症状詳細', '患者状態', '発覚経緯', '対応状況', '対応内容',
    '補足事項', 'Slack通知', 'ステータス'
  ];

  let state = loadState() || createInitialState();

  function createInitialState() {
    const now = new Date();
    return {
      answers: {},
      meta: { summaries: {} },
      currentKey: 'category',
      view: 'question',
      editContext: null,
      pendingSummary: null,
      error: null,
      sent: false,
      ticketId: createTicketId(now),
      startedAt: now.toISOString(),
      submittedAt: null
    };
  }

  function createTicketId(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `HL-${y}${m}${d}-${hh}${mm}${ss}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.answers || !parsed.startedAt || !parsed.ticketId) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // localStorageが利用できない環境では、自動保存だけを無効化する。
    }
  }

  function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    state = createInitialState();
    render();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const date = new Date(iso);
    return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function dateChoices() {
    const today = new Date();
    const choices = [];
    for (let i = 0; i <= 14; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const label = i === 0 ? '本日' : i === 1 ? '昨日' : `${i}日前`;
      choices.push({ label, value: `${label}（${formatDate(date)}）`, sub: formatDate(date) });
    }
    choices.push({ label: 'それ以前', value: 'それ以前', sub: '15日以上前・日付不明の場合' });
    return choices;
  }

  function q(config) {
    return Object.assign({ required: true, summary: false, helper: '', placeholder: '' }, config);
  }

  function buildQuestions(answers) {
    const a = answers || {};
    const qs = [];

    qs.push(q({
      key: 'category',
      phase: '00 大分類選択',
      label: '大分類',
      prompt: 'どの種類の相談ですか？',
      helper: '分からない場合は「その他」で進めてください。AIは判定せず、すべて本部へ通知します。',
      type: 'choice',
      choices: CATEGORIES
    }));

    if (!a.category) return qs;

    if (a.category === '調剤ミス') {
      qs.push(q({
        key: 'errorType',
        phase: '01 ミス種類選択',
        label: 'ミスの種類',
        prompt: 'ミスの種類を選んでください。',
        helper: '近いものを選んでください。最終判断はホットライン担当が行います。',
        type: 'choice',
        choices: ERROR_TYPES.map((label) => ({ label, value: label }))
      }));
    }

    qs.push(q({
      key: 'storeCode',
      phase: '02 基本情報',
      label: '店番',
      prompt: '店番を6桁で入力してください。',
      helper: '例：000769。半角数字6桁で入力してください。',
      type: 'text',
      inputMode: 'numeric',
      placeholder: '例：000769',
      validate: (value) => /^\d{6}$/.test(String(value).trim()) ? null : '店番は6桁の数字で入力してください。'
    }));

    qs.push(q({
      key: 'storeName',
      phase: '02 基本情報',
      label: '店舗名',
      prompt: '店舗名を入力してください。',
      helper: '店番と店舗名は両方必要です。',
      type: 'text',
      placeholder: '例：〇〇薬局 △△店'
    }));

    if (a.category === '調剤ミス') {
      qs.push(q({
        key: 'medicalName',
        phase: '02 基本情報',
        label: '医療機関名',
        prompt: '処方元の医療機関名を入力してください。',
        helper: '分からない場合は「不明」と入力してください。',
        type: 'text',
        placeholder: '例：〇〇クリニック'
      }));

      qs.push(dateQuestion('dosingDate', '03 事象の詳細', '投薬日', '投薬日はいつですか？'));
      qs.push(dateQuestion('discoveryDate', '03 事象の詳細', '発覚日', '発覚日はいつですか？'));

      qs.push(q({
        key: 'patientType',
        phase: '03 事象の詳細',
        label: '新患/既患',
        prompt: '患者様は新患・既患のどちらですか？',
        helper: '分からない場合は「不明」を選択してください。',
        type: 'choice',
        choices: ['新患（初めて）', '既患', '不明'].map((label) => ({ label, value: label }))
      }));

      qs.push(q({
        key: 'ageGroup',
        phase: '03 事象の詳細',
        label: '年齢層',
        prompt: '患者様の年齢層を選んでください。',
        type: 'choice',
        choices: AGE_GROUPS.map((label) => ({ label, value: label }))
      }));

      qs.push(errorDetailQuestion(a.errorType));

      qs.push(q({
        key: 'taken',
        phase: '04 影響の確認',
        label: '服用の有無',
        prompt: '患者様は誤った薬を服用しましたか？',
        helper: '分からない場合は「不明」を選んでください。',
        type: 'choice',
        choices: ['服用した', '服用していない', '不明'].map((label) => ({ label, value: label }))
      }));

      if (a.taken === '服用した') {
        qs.push(q({
          key: 'takenCount',
          phase: '04 影響の確認',
          label: '服用回数',
          prompt: '服用回数・服用期間を入力してください。',
          helper: '分かる範囲で構いません。',
          type: 'text',
          placeholder: '例：1回服用／2日分服用／不明'
        }));
      }

      qs.push(q({
        key: 'health',
        phase: '04 影響の確認',
        label: '健康被害',
        prompt: '健康被害や症状はありますか？',
        helper: '症状がある場合は、次に詳しく入力します。',
        type: 'choice',
        choices: ['あり（症状あり）', 'なし', '不明'].map((label) => ({ label, value: label }))
      }));

      if (String(a.health || '').startsWith('あり')) {
        qs.push(q({
          key: 'healthDetail',
          phase: '04 影響の確認',
          label: '症状詳細',
          prompt: '症状の内容を分かる範囲で入力してください。',
          helper: '15文字以上の場合、読みやすい形に要約して確認します。薬剤名や症状名は原文を保持します。',
          type: 'textarea',
          placeholder: '例：服用後30分ほどで眠気とふらつきが出た。現在は自宅で安静にしている。',
          summary: true
        }));
      }

      qs.push(patientReactionQuestion());
      qs.push(discoveryRouteQuestion());
    } else {
      qs.push(dateQuestion('discoveryDate', '03 事象の詳細', '発覚日', '発覚日はいつですか？'));

      if (a.category !== '管理薬剤の紛失') {
        qs.push(patientReactionQuestion());
      }

      appendCategorySpecificQuestions(qs, a.category);
      qs.push(discoveryRouteQuestion());
    }

    qs.push(q({
      key: 'currentAction',
      phase: '06 対応状況',
      label: '対応状況',
      prompt: '現在の対応状況を選んでください。',
      helper: '未対応以外を選ぶと、次に対応内容を確認します。',
      type: 'choice',
      choices: ACTION_STATUS.map((label) => ({ label, value: label }))
    }));

    if (a.currentAction && a.currentAction !== '未対応') {
      qs.push(q({
        key: 'actionDetail',
        phase: '06 対応状況',
        label: '対応内容',
        prompt: '実施済み・実施予定の対応内容を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        type: 'textarea',
        placeholder: '例：患者様へ電話で謝罪し、薬剤交換のため本日18時に来局予定。医師へも報告済み。',
        summary: true
      }));
    }

    qs.push(q({
      key: 'supplement',
      phase: '07 補足事項',
      label: '補足事項',
      prompt: '他に伝えておきたいことはありますか？',
      helper: '任意です。なければ空欄のまま「次へ」を押してください。',
      type: 'textarea',
      required: false,
      placeholder: '例：患者様のご家族にも連絡済み。PSVには未連絡。'
    }));

    return qs;
  }

  function dateQuestion(key, phase, label, prompt) {
    return q({
      key,
      phase,
      label,
      prompt,
      helper: '本日から過去14日まではボタンで選べます。',
      type: 'choice',
      choices: dateChoices()
    });
  }

  function patientReactionQuestion() {
    return q({
      key: 'patientReaction',
      phase: '05 状況の確認',
      label: '患者様の状態・反応',
      prompt: '患者様の現在の状態・反応に最も近いものを選んでください。',
      helper: '管理薬剤の紛失では、この質問はスキップされます。',
      type: 'choice',
      choices: PATIENT_REACTIONS.map((label) => ({ label, value: label }))
    });
  }

  function discoveryRouteQuestion() {
    return q({
      key: 'discoveryRoute',
      phase: '05 状況の確認',
      label: '発覚経緯',
      prompt: 'どのように発覚しましたか？',
      type: 'choice',
      choices: DISCOVERY_ROUTES.map((label) => ({ label, value: label }))
    });
  }

  function errorDetailQuestion(errorType) {
    const base = {
      key: 'errorDetail',
      phase: '03 事象の詳細',
      label: '正誤情報',
      type: 'textarea',
      helper: '分かる範囲で構いません。薬剤名・規格・数量はそのまま入力してください。',
      placeholder: '例：正：アムロジピンOD錠5mg 28錠／誤：アムロジピンOD錠2.5mg 28錠'
    };

    if (errorType === '渡し忘れ') {
      return q(Object.assign(base, {
        prompt: '渡し忘れた薬剤を入力してください。',
        placeholder: '例：アムロジピンOD錠5mg 28錠を渡し忘れ。'
      }));
    }

    if (errorType === '異薬異物混入') {
      return q(Object.assign(base, {
        prompt: '本来の薬剤と、混入していたものを入力してください。',
        placeholder: '例：本来：A薬／混入：B薬1錠。分包内で発見。'
      }));
    }

    if (errorType === '別患者への投薬') {
      return q(Object.assign(base, {
        prompt: '本来の患者様と、実際に渡した患者様の情報を入力してください。',
        placeholder: '例：本来：A様の薬／実際：B様へ交付。B様は未服用。'
      }));
    }

    if (errorType === '疑義照会漏れ') {
      return q(Object.assign(base, {
        prompt: '疑義照会が必要だった内容を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        placeholder: '例：腎機能低下があり減量確認が必要だったが、疑義照会せず通常量で調剤した。',
        summary: true
      }));
    }

    return q(Object.assign(base, {
      prompt: '正しい内容と誤った内容を入力してください。'
    }));
  }

  function appendCategorySpecificQuestions(qs, category) {
    if (category === '個人情報漏洩') {
      qs.push(q({
        key: 'leakType',
        phase: '03 事象の詳細',
        label: '漏洩した情報の種類',
        prompt: '漏洩した情報の種類を選んでください。',
        type: 'choice',
        choices: ['処方せん', 'お薬手帳', '薬袋・薬情', '領収書・明細書', '問診票・同意書', '電子データ', 'その他'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'leakDetail',
        phase: '03 事象の詳細',
        label: '個人情報漏洩詳細',
        prompt: '具体的な内容を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        type: 'textarea',
        placeholder: '例：A様のお薬手帳を誤ってB様に渡した。B様から連絡があり判明。',
        summary: true
      }));
      qs.push(q({
        key: 'recoveryStatus',
        phase: '03 事象の詳細',
        label: '回収状況',
        prompt: '回収状況を選んでください。',
        type: 'choice',
        choices: ['回収済み', '回収中', '未回収', '対象不明', 'その他'].map((label) => ({ label, value: label }))
      }));
      return;
    }

    if (category === '管理薬剤の紛失') {
      qs.push(q({
        key: 'controlledType',
        phase: '03 事象の詳細',
        label: '薬剤の種類',
        prompt: '紛失した管理薬剤の種類を選んでください。',
        type: 'choice',
        choices: ['麻薬', '覚醒剤原料', '向精神薬', '毒薬・劇薬', 'その他管理薬剤'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'drugNameQty',
        phase: '03 事象の詳細',
        label: '薬剤名と数量',
        prompt: '薬剤名と数量を入力してください。',
        helper: '分かる範囲で構いません。',
        type: 'text',
        placeholder: '例：〇〇錠 10錠／〇〇散 5g'
      }));
      qs.push(q({
        key: 'searchStatus',
        phase: '03 事象の詳細',
        label: '捜索状況',
        prompt: '現在の捜索状況を選んでください。',
        type: 'choice',
        choices: ['捜索中', '一部発見', '発見済み', '未捜索', '不明'].map((label) => ({ label, value: label }))
      }));
      return;
    }

    if (category === 'クレーム') {
      qs.push(q({
        key: 'claimType',
        phase: '03 事象の詳細',
        label: 'クレーム分類',
        prompt: 'クレームの分類を選んでください。',
        type: 'choice',
        choices: ['接遇', '待ち時間', '説明内容', '料金', '調剤内容', '個人情報', 'その他'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'claimDetail',
        phase: '03 事象の詳細',
        label: 'クレーム内容',
        prompt: 'クレーム内容を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        type: 'textarea',
        placeholder: '例：待ち時間が長いことについて患者様がお怒り。説明不足を指摘された。',
        summary: true
      }));
      qs.push(q({
        key: 'escalationRisk',
        phase: '03 事象の詳細',
        label: '二次クレーム発展リスク',
        prompt: '二次クレームに発展しそうですか？',
        type: 'choice',
        choices: ['高い', '可能性あり', '低い', '不明'].map((label) => ({ label, value: label }))
      }));
      return;
    }

    if (category === '事故') {
      qs.push(q({
        key: 'accidentType',
        phase: '03 事象の詳細',
        label: '事故の種類',
        prompt: '事故の種類を選んでください。',
        type: 'choice',
        choices: ['車両事故', '針刺し事故', '転倒・転落', '設備破損', '患者様・従業員のけが', 'その他'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'injury',
        phase: '03 事象の詳細',
        label: 'けが人の有無',
        prompt: 'けが人はいますか？',
        type: 'choice',
        choices: ['あり', 'なし', '不明'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'accidentDetail',
        phase: '03 事象の詳細',
        label: '事故概要',
        prompt: '事故の概要を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        type: 'textarea',
        placeholder: '例：配達中に店舗駐車場で車両を接触。けが人なし。警察への連絡は未実施。',
        summary: true
      }));
      return;
    }

    if (category === '法令遵守違反') {
      qs.push(q({
        key: 'violationType',
        phase: '03 事象の詳細',
        label: '違反の種類',
        prompt: '違反の種類に近いものを選んでください。',
        helper: '判断は本部で行います。近いものを選んで進めてください。',
        type: 'choice',
        choices: ['偽造処方せん', '無資格対応の疑い', '記録不備', '期限切れ・保管不備', '説明・同意手続き不備', 'その他'].map((label) => ({ label, value: label }))
      }));
      qs.push(q({
        key: 'violationDetail',
        phase: '03 事象の詳細',
        label: '法令違反内容',
        prompt: '内容を入力してください。',
        helper: '15文字以上の場合、読みやすい形に要約して確認します。',
        type: 'textarea',
        placeholder: '例：偽造の疑いがある処方せんを受付。医療機関へ確認前で、患者様は店内にいない。',
        summary: true
      }));
      return;
    }

    qs.push(q({
      key: 'otherDetail',
      phase: '03 事象の詳細',
      label: 'その他状況',
      prompt: '状況の概要を入力してください。',
      helper: '15文字以上の場合、読みやすい形に要約して確認します。',
      type: 'textarea',
      placeholder: '例：分類に迷う事案。患者様から電話があり、詳しい内容は確認中。',
      summary: true
    }));
  }

  function getQuestions() {
    return buildQuestions(state.answers);
  }

  function getQuestionByKey(key) {
    return getQuestions().find((item) => item.key === key) || null;
  }

  function isAnswered(question, answers) {
    if (!question) return false;
    if (question.required === false) {
      return Object.prototype.hasOwnProperty.call(answers, question.key);
    }
    const value = answers[question.key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  function findNextUnanswered(answers, fromKey) {
    const qs = buildQuestions(answers);
    const startIndex = fromKey ? Math.max(qs.findIndex((item) => item.key === fromKey) + 1, 0) : 0;
    for (let i = startIndex; i < qs.length; i += 1) {
      if (!isAnswered(qs[i], answers)) return qs[i].key;
    }
    for (let i = 0; i < qs.length; i += 1) {
      if (!isAnswered(qs[i], answers)) return qs[i].key;
    }
    return null;
  }

  function completedCount(answers) {
    return getQuestions().filter((item) => isAnswered(item, answers)).length;
  }

  function validateAnswer(question, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (question.required !== false && value === '') {
      return `${question.label}を入力してください。`;
    }
    if (typeof question.validate === 'function') {
      return question.validate(value);
    }
    return null;
  }

  function pruneAnswers(inputAnswers, changedKey) {
    let next = Object.assign({}, inputAnswers);

    if (changedKey === 'category') {
      next = {
        category: next.category,
        storeCode: next.storeCode,
        storeName: next.storeName
      };
      Object.keys(next).forEach((key) => {
        if (next[key] === undefined) delete next[key];
      });
    }

    if (changedKey === 'errorType') {
      delete next.errorDetail;
    }

    if (changedKey === 'taken' && next.taken !== '服用した') {
      delete next.takenCount;
    }

    if (changedKey === 'health' && !String(next.health || '').startsWith('あり')) {
      delete next.healthDetail;
    }

    if (changedKey === 'currentAction' && next.currentAction === '未対応') {
      delete next.actionDetail;
    }

    const allowedKeys = new Set(buildQuestions(next).map((item) => item.key));
    Object.keys(next).forEach((key) => {
      if (!allowedKeys.has(key)) delete next[key];
    });

    return next;
  }

  function shouldSummarize(question, value) {
    if (!question.summary) return false;
    const text = String(value || '').trim();
    return text.length >= 15;
  }

  function summarizeText(raw) {
    let text = String(raw || '').replace(/\r\n/g, '\n').trim();
    const fillers = [
      'えーっと', 'えっと', 'あのー', 'あの、', 'その、', 'そのー', 'なんというか',
      'ちょっと', '少し', 'たぶん', 'おそらく', '一応', 'とりあえず'
    ];
    fillers.forEach((word) => {
      text = text.split(word).join('');
    });
    text = text
      .replace(/という感じです/g, '')
      .replace(/という感じで/g, '')
      .replace(/みたいな/g, '')
      .replace(/と思います/g, '')
      .replace(/かもしれません/g, '可能性があります')
      .replace(/ですけど/g, 'です。')
      .replace(/なんですが/g, 'です。')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/、{2,}/g, '、')
      .replace(/。{2,}/g, '。')
      .replace(/[、，\s]+$/g, '')
      .trim();

    if (text.length > 260) {
      const sentences = text.split(/(?<=。|！|!|？|\?)/).map((item) => item.trim()).filter(Boolean);
      const selected = [];
      let length = 0;
      sentences.forEach((sentence) => {
        if (selected.length < 4 && length + sentence.length <= 240) {
          selected.push(sentence);
          length += sentence.length;
        }
      });
      text = selected.length ? selected.join('') : `${text.slice(0, 240)}…`;
    }

    if (text && !/[。！？!?]$/.test(text)) {
      text += '。';
    }
    return text;
  }

  function handleAnswer(rawValue) {
    const question = getQuestionByKey(state.currentKey);
    if (!question) return;
    const value = String(rawValue ?? '').trim();
    const validationError = validateAnswer(question, value);
    if (validationError) {
      state.error = validationError;
      saveState();
      render();
      return;
    }

    let nextAnswers = Object.assign({}, state.answers, { [question.key]: value });
    nextAnswers = pruneAnswers(nextAnswers, question.key);

    const summary = summarizeText(value);
    if (shouldSummarize(question, value) && summary && summary !== value) {
      state.answers = nextAnswers;
      state.pendingSummary = {
        key: question.key,
        label: question.label,
        original: value,
        summary,
        context: state.editContext ? Object.assign({}, state.editContext) : null
      };
      state.editContext = null;
      state.view = 'summary';
      state.error = null;
      saveState();
      render();
      return;
    }

    state.answers = nextAnswers;
    state.error = null;
    finalizeNavigation(question.key);
  }

  function finalizeNavigation(answeredKey) {
    const context = state.editContext;
    state.editContext = null;

    if (context && context.origin === 'review') {
      state.view = 'review';
      state.currentKey = findNextUnanswered(state.answers) || state.currentKey || 'category';
      saveState();
      render();
      return;
    }

    if (context && context.origin === 'progress') {
      const questions = buildQuestions(state.answers);
      const returnQuestion = context.returnKey ? questions.find((item) => item.key === context.returnKey) : null;
      if (returnQuestion && !isAnswered(returnQuestion, state.answers)) {
        state.currentKey = returnQuestion.key;
        state.view = 'question';
      } else {
        const nextKey = findNextUnanswered(state.answers, answeredKey);
        state.currentKey = nextKey || state.currentKey || 'category';
        state.view = nextKey ? 'question' : 'review';
      }
      saveState();
      render();
      return;
    }

    const nextKey = findNextUnanswered(state.answers, answeredKey);
    state.currentKey = nextKey || state.currentKey || 'category';
    state.view = nextKey ? 'question' : 'review';
    saveState();
    render();
  }

  function commitPendingSummary(mode) {
    const pending = state.pendingSummary;
    if (!pending) return;

    if (mode === 'rewrite') {
      state.pendingSummary = null;
      state.currentKey = pending.key;
      state.editContext = pending.context;
      state.view = pending.context ? 'editQuestion' : 'question';
      state.error = null;
      saveState();
      render();
      return;
    }

    const adoptedText = mode === 'summary' ? pending.summary : pending.original;
    state.answers = pruneAnswers(Object.assign({}, state.answers, { [pending.key]: adoptedText }), pending.key);
    state.meta = state.meta || { summaries: {} };
    state.meta.summaries = state.meta.summaries || {};
    state.meta.summaries[pending.key] = {
      original: pending.original,
      summary: pending.summary,
      adopted: mode === 'summary' ? 'summary' : 'original'
    };
    state.pendingSummary = null;
    state.editContext = pending.context;
    state.error = null;
    finalizeNavigation(pending.key);
  }

  function render() {
    const app = document.getElementById('app');
    if (!app) return;

    const nextKey = findNextUnanswered(state.answers);
    if (state.view === 'question' && !getQuestionByKey(state.currentKey)) {
      state.currentKey = nextKey || 'category';
      state.view = nextKey ? 'question' : 'review';
    }

    if (state.view === 'summary') {
      app.innerHTML = layout(renderSummaryContent(), { mode: 'summary' });
      bindCommonActions();
      bindSummaryActions();
      return;
    }

    if (state.view === 'review') {
      app.innerHTML = layout(renderReviewContent(), { mode: 'review' });
      bindCommonActions();
      bindReviewActions();
      return;
    }

    if (state.view === 'editList') {
      app.innerHTML = layout(renderEditListContent(), { mode: 'editList' });
      bindCommonActions();
      bindEditListActions();
      return;
    }

    if (state.view === 'done') {
      app.innerHTML = layout(renderDoneContent(), { mode: 'done' });
      bindCommonActions();
      bindDoneActions();
      return;
    }

    app.innerHTML = layout(renderQuestionContent(), { mode: state.view });
    bindCommonActions();
    bindQuestionActions();
  }

  function layout(contentHtml, options) {
    const mode = options && options.mode;
    const category = state.answers.category || '未選択';
    const store = formatStore();
    const policy = '全件Slack通知・AI判定なし';
    return `
      <div class="shell">
        <header class="topbar">
          <div class="brand">
            <div class="brand-mark">HL</div>
            <div>
              <h1>ホットラインAIエージェント</h1>
              <p>忙しい店舗でも、選択中心で本部相談に必要な情報を漏れなく整理します。</p>
            </div>
          </div>
          <aside class="phone-box">
            <strong>入力中でも電話に切替可能</strong>
            <span>不安な場合は、従来どおりホットラインへ電話してください。アプリは判断を代行しません。</span>
            <div class="actions" style="margin-top:10px">
              <button class="btn btn-warn" id="phoneFallback">電話相談に切替</button>
            </div>
          </aside>
        </header>

        <main class="main-grid">
          <section class="main-panel" aria-live="polite">
            <div class="status-strip">
              <div class="status-item"><b>分類</b><span>${escapeHtml(category)}</span></div>
              <div class="status-item"><b>店舗</b><span>${escapeHtml(store)}</span></div>
              <div class="status-item"><b>送信方針</b><span>${escapeHtml(policy)}</span></div>
            </div>
            <div class="content">
              ${contentHtml}
            </div>
          </section>
          <aside class="side-panel">
            <h3>安心して進めるための前提</h3>
            <ul class="side-list">
              <li><b>AIは判定しません</b>ミスレベルや対応要否は本部・ホットライン担当が確認します。</li>
              <li><b>選択中心です</b>文章入力が必要な箇所は、読みやすく要約してから確認します。</li>
              <li><b>途中修正できます</b>前の回答に戻っても、最初からやり直す必要はありません。</li>
              <li><b>下書き自動保存</b>同じブラウザでは入力途中から再開できます。</li>
            </ul>
            <div class="actions">
              ${mode !== 'done' ? '<button class="btn btn-ghost" id="clearDraft">下書きを破棄</button>' : ''}
            </div>
          </aside>
        </main>
      </div>`;
  }

  function progressHtml() {
    const questions = getQuestions();
    const total = Math.max(questions.length, 1);
    const done = completedCount(state.answers);
    const current = state.view === 'review' || state.view === 'done' ? total : Math.min(done + 1, total);
    const percent = Math.max(6, Math.round((done / total) * 100));
    return `
      <div class="progress-wrap">
        <div class="progress-top">
          <span>入力進捗：${escapeHtml(done)} / ${escapeHtml(total)} 項目</span>
          <span>${escapeHtml(current)}問目</span>
        </div>
        <div class="progress-bar" aria-hidden="true"><div class="progress-fill" style="width:${percent}%"></div></div>
      </div>`;
  }

  function renderQuestionContent() {
    const question = getQuestionByKey(state.currentKey) || getQuestionByKey(findNextUnanswered(state.answers));
    if (!question) return renderReviewContent();
    state.currentKey = question.key;
    const answered = completedCount(state.answers) > 0;
    const editing = state.view === 'editQuestion';
    return `
      ${progressHtml()}
      ${answered && !editing ? '<button class="link-btn" id="openEditList">← 前の回答を修正する</button>' : ''}
      ${editing ? '<div class="notice notice-blue">この項目だけ修正します。保存後は元の画面に戻ります。</div>' : ''}
      <div class="chat-row">
        <div class="avatar">AI</div>
        <div class="bubble">
          <div class="eyebrow">${escapeHtml(question.phase)}</div>
          <h2>${escapeHtml(question.prompt)}</h2>
          ${question.helper ? `<p>${escapeHtml(question.helper)}</p>` : ''}
        </div>
      </div>
      ${renderAnswerControl(question)}
    `;
  }

  function renderAnswerControl(question) {
    const value = state.answers[question.key] || '';
    if (question.type === 'choice') {
      const choices = (question.choices || []).map(normalizeChoice);
      return `
        <div class="choice-grid">
          ${choices.map((choice) => `
            <button class="choice-btn" data-choice="${escapeAttr(choice.value)}">
              <span class="label">${escapeHtml(choice.label)}</span>
              ${choice.sub ? `<span class="sub">${escapeHtml(choice.sub)}</span>` : ''}
            </button>`).join('')}
        </div>
        ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}
      `;
    }

    const isTextarea = question.type === 'textarea';
    const control = isTextarea
      ? `<textarea class="textarea" id="answerField" placeholder="${escapeAttr(question.placeholder)}">${escapeHtml(value)}</textarea>`
      : `<input class="input" id="answerField" value="${escapeAttr(value)}" inputmode="${escapeAttr(question.inputMode || 'text')}" placeholder="${escapeAttr(question.placeholder)}" />`;

    return `
      <form class="form-card" id="answerForm">
        <label class="field-label" for="answerField">${escapeHtml(question.label)}</label>
        ${control}
        <div class="helper-row">
          <span>${question.required === false ? '任意入力です。空欄でも進めます。' : '必須項目です。'}</span>
          ${question.summary ? '<span>15文字以上は要約確認あり</span>' : ''}
        </div>
        ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}
        <div class="actions">
          <button class="btn btn-primary" type="submit">次へ</button>
          ${question.required === false ? '<button class="btn btn-secondary" type="button" id="skipOptional">なし・空欄で進む</button>' : ''}
        </div>
      </form>`;
  }

  function normalizeChoice(choice) {
    if (typeof choice === 'string') return { label: choice, value: choice, sub: '' };
    return Object.assign({ sub: '' }, choice);
  }

  function renderSummaryContent() {
    const pending = state.pendingSummary;
    if (!pending) return renderQuestionContent();
    return `
      ${progressHtml()}
      <div class="notice notice-blue">
        入力文を読みやすく整えました。事実が変わっていないか確認してください。
      </div>
      <div class="chat-row">
        <div class="avatar">AI</div>
        <div class="bubble">
          <div class="eyebrow">AI要約確認</div>
          <h2>この内容で記録してよいですか？</h2>
          <p>薬剤名・数量・症状など、事実情報が変わっていないかだけ確認してください。</p>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-box">
          <h3>元の入力</h3>
          <p>${escapeHtml(pending.original)}</p>
        </div>
        <div class="summary-box">
          <h3>要約案</h3>
          <p>${escapeHtml(pending.summary)}</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="acceptSummary">要約を採用</button>
        <button class="btn btn-secondary" id="keepOriginal">元の文のまま採用</button>
        <button class="btn btn-ghost" id="rewriteSummary">書き直す</button>
      </div>
    `;
  }

  function renderReviewContent() {
    const questions = getQuestions();
    const rows = questions.filter((item) => isAnswered(item, state.answers));
    const slack = buildSlackMessage();
    const sheetRow = buildSheetRow();
    return `
      ${progressHtml()}
      <div class="notice notice-safe">
        入力内容を確認してください。確定すると、Slack通知と管理表記入のモック処理を実行します。AIによる判定は行いません。
      </div>
      <div class="chat-row">
        <div class="avatar">AI</div>
        <div class="bubble">
          <div class="eyebrow">08 入力内容の確認</div>
          <h2>この内容で本部へ相談します。</h2>
          <p>修正したい項目だけ編集できます。最初からやり直す必要はありません。</p>
        </div>
      </div>
      <div class="review-list">
        ${rows.map((item) => `
          <div class="review-item">
            <div class="review-label">${escapeHtml(item.label)}</div>
            <div class="review-value">${escapeHtml(formatAnswerValue(item.key, state.answers[item.key]))}</div>
            <button class="btn btn-ghost" data-edit-key="${escapeAttr(item.key)}">修正</button>
          </div>`).join('')}
      </div>
      <details>
        <summary>Slack通知プレビュー</summary>
        <pre class="preview">${escapeHtml(slack)}</pre>
      </details>
      <details>
        <summary>管理表24列プレビュー</summary>
        <table class="sheet-table">
          <tbody>
            ${SHEET_COLUMNS.map((column, index) => `
              <tr><th>${escapeHtml(index + 1)}. ${escapeHtml(column)}</th><td>${escapeHtml(sheetRow[index] || '')}</td></tr>`).join('')}
          </tbody>
        </table>
      </details>
      <div class="actions">
        <button class="btn btn-primary" id="submitReport">この内容で本部へ送信する</button>
        <button class="btn btn-secondary" id="reviewEditList">修正する</button>
      </div>
    `;
  }

  function renderEditListContent() {
    const rows = getQuestions().filter((item) => isAnswered(item, state.answers));
    return `
      ${progressHtml()}
      <div class="chat-row">
        <div class="avatar">AI</div>
        <div class="bubble">
          <div class="eyebrow">06 修正機能</div>
          <h2>修正する項目を選んでください。</h2>
          <p>修正後は、元の質問に戻って続行します。分類を変えた場合は関連項目だけ聞き直します。</p>
        </div>
      </div>
      <div class="edit-grid">
        ${rows.map((item) => `
          <button class="edit-item" data-edit-key="${escapeAttr(item.key)}">
            <b>${escapeHtml(item.label)}</b>
            <span>${escapeHtml(formatAnswerValue(item.key, state.answers[item.key]))}</span>
          </button>`).join('')}
      </div>
      <div class="actions">
        <button class="btn btn-ghost" id="cancelEditList">戻る</button>
      </div>
    `;
  }

  function renderDoneContent() {
    const submitted = state.submittedAt ? formatDateTime(state.submittedAt) : formatDateTime(new Date().toISOString());
    return `
      <div class="done-card">
        <div class="done-icon">✓</div>
        <h2>本部への相談を受け付けました</h2>
        <p>Slack通知と管理表記入のモック処理が完了しました。実運用版では、このタイミングで #ホットライン報告 へ投稿し、管理表へ24列で自動転記します。</p>
        <div class="notice notice-safe" style="text-align:left; max-width:760px; margin:0 auto 18px;">
          受付番号：<b>${escapeHtml(state.ticketId)}</b><br>
          受付時刻：${escapeHtml(submitted)}<br>
          Slack通知：通知済み ／ 管理表：記入済み
        </div>
        <div class="next-steps">
          <div class="step-card"><b>1. 報告内容が本部に共有されました</b>#ホットライン報告 へ投稿された想定です。</div>
          <div class="step-card"><b>2. PSVまたは営業部長から店舗へ電話連絡があります</b>対応方法の指示がありますので、店舗では連絡を受けられる状態にしてください。</div>
          <div class="step-card"><b>3. 対応完了後はPSVへ完了連絡をお願いします</b>必要に応じて管理表のステータスを本部側で更新します。</div>
        </div>
        <div class="actions" style="justify-content:center;">
          <button class="btn btn-primary" id="newReport">別件を報告する</button>
          <button class="btn btn-ghost" id="backToReview">通知内容を確認する</button>
        </div>
      </div>
    `;
  }

  function bindCommonActions() {
    const phone = document.getElementById('phoneFallback');
    if (phone) phone.addEventListener('click', openPhoneModal);

    const clear = document.getElementById('clearDraft');
    if (clear) {
      clear.addEventListener('click', () => {
        if (window.confirm('入力中の下書きを破棄して、最初からやり直しますか？')) {
          resetState();
        }
      });
    }

    const close = document.getElementById('closePhoneModal');
    if (close) close.addEventListener('click', closePhoneModal);

    const modal = document.getElementById('phoneModal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closePhoneModal();
      });
    }
  }

  function bindQuestionActions() {
    document.querySelectorAll('[data-choice]').forEach((button) => {
      button.addEventListener('click', () => handleAnswer(button.dataset.choice));
    });

    const form = document.getElementById('answerForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const field = document.getElementById('answerField');
        handleAnswer(field ? field.value : '');
      });
    }

    const skip = document.getElementById('skipOptional');
    if (skip) skip.addEventListener('click', () => handleAnswer(''));

    const openEditList = document.getElementById('openEditList');
    if (openEditList) {
      openEditList.addEventListener('click', () => {
        state.view = 'editList';
        state.editContext = { origin: 'progress', returnKey: state.currentKey };
        state.error = null;
        saveState();
        render();
      });
    }

    const field = document.getElementById('answerField');
    if (field) field.focus();
  }

  function bindSummaryActions() {
    const accept = document.getElementById('acceptSummary');
    const keep = document.getElementById('keepOriginal');
    const rewrite = document.getElementById('rewriteSummary');
    if (accept) accept.addEventListener('click', () => commitPendingSummary('summary'));
    if (keep) keep.addEventListener('click', () => commitPendingSummary('original'));
    if (rewrite) rewrite.addEventListener('click', () => commitPendingSummary('rewrite'));
  }

  function bindReviewActions() {
    document.querySelectorAll('[data-edit-key]').forEach((button) => {
      button.addEventListener('click', () => startEdit(button.dataset.editKey, 'review'));
    });

    const reviewEditList = document.getElementById('reviewEditList');
    if (reviewEditList) {
      reviewEditList.addEventListener('click', () => {
        state.view = 'editList';
        state.editContext = { origin: 'review', returnKey: null };
        state.error = null;
        saveState();
        render();
      });
    }

    const submit = document.getElementById('submitReport');
    if (submit) {
      submit.addEventListener('click', () => {
        state.sent = true;
        state.submittedAt = new Date().toISOString();
        state.view = 'done';
        state.error = null;
        saveState();
        render();
      });
    }
  }

  function bindEditListActions() {
    document.querySelectorAll('[data-edit-key]').forEach((button) => {
      const origin = state.editContext && state.editContext.origin === 'review' ? 'review' : 'progress';
      button.addEventListener('click', () => startEdit(button.dataset.editKey, origin));
    });

    const cancel = document.getElementById('cancelEditList');
    if (cancel) {
      cancel.addEventListener('click', () => {
        const context = state.editContext;
        if (context && context.origin === 'review') {
          state.view = 'review';
        } else {
          state.view = 'question';
        }
        state.error = null;
        saveState();
        render();
      });
    }
  }

  function bindDoneActions() {
    const newReport = document.getElementById('newReport');
    if (newReport) newReport.addEventListener('click', resetState);

    const backToReview = document.getElementById('backToReview');
    if (backToReview) {
      backToReview.addEventListener('click', () => {
        state.view = 'review';
        saveState();
        render();
      });
    }
  }

  function startEdit(key, origin) {
    const existingContext = state.editContext || {};
    state.currentKey = key;
    state.view = 'editQuestion';
    state.editContext = {
      origin,
      returnKey: origin === 'progress' ? (existingContext.returnKey || key) : null
    };
    state.error = null;
    saveState();
    render();
  }

  function openPhoneModal() {
    const modal = document.getElementById('phoneModal');
    if (modal) modal.classList.add('open');
  }

  function closePhoneModal() {
    const modal = document.getElementById('phoneModal');
    if (modal) modal.classList.remove('open');
  }

  function formatStore() {
    const code = state.answers.storeCode;
    const name = state.answers.storeName;
    if (code && name) return `${code} ${name}`;
    if (code) return code;
    if (name) return name;
    return '未入力';
  }

  function formatAnswerValue(key, value) {
    const text = String(value ?? '').trim();
    if (key === 'supplement' && text === '') return 'なし';
    return text || '未入力';
  }

  function classification() {
    const category = state.answers.category || '-';
    if (category === '調剤ミス' && state.answers.errorType) {
      return `${category} / ${state.answers.errorType}`;
    }
    return category;
  }

  function isRiskMentionNeeded() {
    const a = state.answers;
    return a.category === '個人情報漏洩'
      || a.category === '管理薬剤の紛失'
      || a.category === '法令遵守違反'
      || a.category === '事故'
      || String(a.health || '').startsWith('あり');
  }

  function buildSlackMessage() {
    const a = state.answers;
    const mentions = ['@PSV', '@営業部長', '@統括部長'];
    if (isRiskMentionNeeded()) mentions.push('@リスク担当');

    const lines = [
      '【ホットライン報告】',
      `受付番号：${state.ticketId}`,
      `メンション：${mentions.join(' ')}`,
      '',
      `分類：${classification()}`,
      `店舗：${a.storeCode || '-'} ${a.storeName || ''}`.trim(),
      `医療機関名：${a.medicalName || '-'}`,
      `投薬日：${a.dosingDate || '-'}`,
      `発覚日：${a.discoveryDate || '-'}`,
      `新患/既患：${a.patientType || '-'}`,
      `年齢層：${a.ageGroup || '-'}`,
      '',
      `正/誤・事象詳細：${eventDetailText()}`,
      `服用有無：${a.taken || '-'}`,
      `服用回数：${a.takenCount || '-'}`,
      `健康被害：${a.health || '-'}`,
      `症状詳細：${a.healthDetail || '-'}`,
      `患者状態：${a.patientReaction || '-'}`,
      `発覚経緯：${a.discoveryRoute || '-'}`,
      '',
      `対応状況：${a.currentAction || '-'}`,
      `対応内容：${a.actionDetail || '-'}`,
      `補足事項：${a.supplement || 'なし'}`,
      '',
      '※AIによる判定なし。全件確認をお願いします。'
    ];
    return lines.join('\n');
  }

  function eventDetailText() {
    const a = state.answers;
    if (a.category === '調剤ミス') return a.errorDetail || '-';
    if (a.category === '個人情報漏洩') return [a.leakType, a.leakDetail, a.recoveryStatus].filter(Boolean).join(' / ') || '-';
    if (a.category === '管理薬剤の紛失') return [a.controlledType, a.drugNameQty, a.searchStatus].filter(Boolean).join(' / ') || '-';
    if (a.category === 'クレーム') return [a.claimType, a.claimDetail, a.escalationRisk].filter(Boolean).join(' / ') || '-';
    if (a.category === '事故') return [a.accidentType, a.injury, a.accidentDetail].filter(Boolean).join(' / ') || '-';
    if (a.category === '法令遵守違反') return [a.violationType, a.violationDetail].filter(Boolean).join(' / ') || '-';
    if (a.category === 'その他') return a.otherDetail || '-';
    return '-';
  }

  function buildSheetRow() {
    const a = state.answers;
    const started = new Date(state.startedAt);
    return [
      state.ticketId,
      formatDate(started),
      `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
      a.storeCode || '',
      a.storeName || '',
      a.medicalName || '',
      a.dosingDate || '',
      a.discoveryDate || '',
      a.patientType || '',
      a.ageGroup || '',
      classification(),
      'HL担当入力',
      a.errorDetail || eventDetailText(),
      a.taken || '',
      a.takenCount || '',
      a.health || '',
      a.healthDetail || '',
      a.patientReaction || '',
      a.discoveryRoute || '',
      a.currentAction || '',
      a.actionDetail || '',
      a.supplement || '',
      state.sent ? '通知済み' : '未通知',
      state.sent ? '受付済' : '未送信'
    ];
  }

  render();
}());
