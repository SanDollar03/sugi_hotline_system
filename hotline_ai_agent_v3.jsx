import React, { useEffect, useMemo, useState } from 'react';
import './hotline_ai_agent_v3.css';

const STORAGE_KEY = 'hotline_ai_agent_v3_react_state_v1';

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
  '疑義照会漏れ', '規格間違い', '数量間違い／ピッキング数間違い', '用量間違い', '用法間違い',
  '渡し忘れ', '分包ミス', '異薬異物混入', '入力間違い／漏れ', '薬剤名称／変更間違い',
  '剤形間違い', '別患者への投薬', 'カレンダーセット間違い', 'その他'
];

const AGE_GROUPS = ['10歳未満', '10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代以上', '不明'];
const PATIENT_REACTIONS = ['お怒り', '体調不良', '不安', '問題なし', '未接触', '不明'];
const DISCOVERY_ROUTES = ['薬局内で発見', '患者様から連絡', '医療機関から連絡', '本部・PSVから連絡', 'その他', '不明'];
const ACTION_STATUS = ['未対応', '対応中', '対応予定あり', '対応済み'];
const SHEET_COLUMNS = ['No.', '起票日', '時刻', '店番', '店名', '医療機関名', '投薬日', '発覚日', '新患/既患', '年齢層', '分類', 'ミスレベル', '正/誤', '服用有無', '服用回数', '健康被害', '症状詳細', '患者状態', '発覚経緯', '対応状況', '対応内容', '補足事項', 'Slack通知', 'ステータス'];

function initialState() {
  const now = new Date();
  return {
    answers: {},
    meta: { summaries: {} },
    currentKey: 'category',
    mode: 'question',
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
    return raw ? JSON.parse(raw) : initialState();
  } catch {
    return initialState();
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function dateChoices() {
  const today = new Date();
  const out = [];
  for (let i = 0; i <= 14; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = i === 0 ? '本日' : i === 1 ? '昨日' : `${i}日前`;
    out.push({ label, value: `${label}（${formatDate(d)}）`, sub: formatDate(d) });
  }
  out.push({ label: 'それ以前', value: 'それ以前', sub: '15日以上前・日付不明の場合' });
  return out;
}

function q(config) {
  return { required: true, summary: false, helper: '', placeholder: '', ...config };
}

function dateQuestion(key, phase, label, prompt) {
  return q({ key, phase, label, prompt, helper: '本日から過去14日まではボタンで選べます。', type: 'choice', choices: dateChoices() });
}

function patientReactionQuestion() {
  return q({
    key: 'patientReaction', phase: '05 状況の確認', label: '患者様の状態・反応',
    prompt: '患者様の現在の状態・反応に最も近いものを選んでください。', type: 'choice',
    choices: PATIENT_REACTIONS.map((label) => ({ label, value: label }))
  });
}

function discoveryRouteQuestion() {
  return q({
    key: 'discoveryRoute', phase: '05 状況の確認', label: '発覚経緯', prompt: 'どのように発覚しましたか？', type: 'choice',
    choices: DISCOVERY_ROUTES.map((label) => ({ label, value: label }))
  });
}

function errorDetailQuestion(errorType) {
  const base = {
    key: 'errorDetail', phase: '03 事象の詳細', label: '正誤情報', type: 'textarea',
    helper: '分かる範囲で構いません。薬剤名・規格・数量はそのまま入力してください。',
    placeholder: '例：正：アムロジピンOD錠5mg 28錠／誤：アムロジピンOD錠2.5mg 28錠'
  };
  if (errorType === '渡し忘れ') return q({ ...base, prompt: '渡し忘れた薬剤を入力してください。', placeholder: '例：アムロジピンOD錠5mg 28錠を渡し忘れ。' });
  if (errorType === '異薬異物混入') return q({ ...base, prompt: '本来の薬剤と、混入していたものを入力してください。', placeholder: '例：本来：A薬／混入：B薬1錠。分包内で発見。' });
  if (errorType === '別患者への投薬') return q({ ...base, prompt: '本来の患者様と、実際に渡した患者様の情報を入力してください。', placeholder: '例：本来：A様の薬／実際：B様へ交付。B様は未服用。' });
  if (errorType === '疑義照会漏れ') return q({ ...base, prompt: '疑義照会が必要だった内容を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', summary: true });
  return q({ ...base, prompt: '正しい内容と誤った内容を入力してください。' });
}

function appendCategorySpecificQuestions(qs, category) {
  const choice = (items) => items.map((label) => ({ label, value: label }));
  if (category === '個人情報漏洩') {
    qs.push(q({ key: 'leakType', phase: '03 事象の詳細', label: '漏洩した情報の種類', prompt: '漏洩した情報の種類を選んでください。', type: 'choice', choices: choice(['処方せん', 'お薬手帳', '薬袋・薬情', '領収書・明細書', '問診票・同意書', '電子データ', 'その他']) }));
    qs.push(q({ key: 'leakDetail', phase: '03 事象の詳細', label: '個人情報漏洩詳細', prompt: '具体的な内容を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：A様のお薬手帳を誤ってB様に渡した。B様から連絡があり判明。', summary: true }));
    qs.push(q({ key: 'recoveryStatus', phase: '03 事象の詳細', label: '回収状況', prompt: '回収状況を選んでください。', type: 'choice', choices: choice(['回収済み', '回収中', '未回収', '対象不明', 'その他']) }));
    return;
  }
  if (category === '管理薬剤の紛失') {
    qs.push(q({ key: 'controlledType', phase: '03 事象の詳細', label: '薬剤の種類', prompt: '紛失した管理薬剤の種類を選んでください。', type: 'choice', choices: choice(['麻薬', '覚醒剤原料', '向精神薬', '毒薬・劇薬', 'その他管理薬剤']) }));
    qs.push(q({ key: 'drugNameQty', phase: '03 事象の詳細', label: '薬剤名と数量', prompt: '薬剤名と数量を入力してください。', type: 'text', placeholder: '例：〇〇錠 10錠／〇〇散 5g' }));
    qs.push(q({ key: 'searchStatus', phase: '03 事象の詳細', label: '捜索状況', prompt: '現在の捜索状況を選んでください。', type: 'choice', choices: choice(['捜索中', '一部発見', '発見済み', '未捜索', '不明']) }));
    return;
  }
  if (category === 'クレーム') {
    qs.push(q({ key: 'claimType', phase: '03 事象の詳細', label: 'クレーム分類', prompt: 'クレームの分類を選んでください。', type: 'choice', choices: choice(['接遇', '待ち時間', '説明内容', '料金', '調剤内容', '個人情報', 'その他']) }));
    qs.push(q({ key: 'claimDetail', phase: '03 事象の詳細', label: 'クレーム内容', prompt: 'クレーム内容を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：待ち時間が長いことについて患者様がお怒り。説明不足を指摘された。', summary: true }));
    qs.push(q({ key: 'escalationRisk', phase: '03 事象の詳細', label: '二次クレーム発展リスク', prompt: '二次クレームに発展しそうですか？', type: 'choice', choices: choice(['高い', '可能性あり', '低い', '不明']) }));
    return;
  }
  if (category === '事故') {
    qs.push(q({ key: 'accidentType', phase: '03 事象の詳細', label: '事故の種類', prompt: '事故の種類を選んでください。', type: 'choice', choices: choice(['車両事故', '針刺し事故', '転倒・転落', '設備破損', '患者様・従業員のけが', 'その他']) }));
    qs.push(q({ key: 'injury', phase: '03 事象の詳細', label: 'けが人の有無', prompt: 'けが人はいますか？', type: 'choice', choices: choice(['あり', 'なし', '不明']) }));
    qs.push(q({ key: 'accidentDetail', phase: '03 事象の詳細', label: '事故概要', prompt: '事故の概要を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：配達中に店舗駐車場で車両を接触。けが人なし。警察への連絡は未実施。', summary: true }));
    return;
  }
  if (category === '法令遵守違反') {
    qs.push(q({ key: 'violationType', phase: '03 事象の詳細', label: '違反の種類', prompt: '違反の種類に近いものを選んでください。', type: 'choice', choices: choice(['偽造処方せん', '無資格対応の疑い', '記録不備', '期限切れ・保管不備', '説明・同意手続き不備', 'その他']) }));
    qs.push(q({ key: 'violationDetail', phase: '03 事象の詳細', label: '法令違反内容', prompt: '内容を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：偽造の疑いがある処方せんを受付。医療機関へ確認前で、患者様は店内にいない。', summary: true }));
    return;
  }
  qs.push(q({ key: 'otherDetail', phase: '03 事象の詳細', label: 'その他状況', prompt: '状況の概要を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：分類に迷う事案。患者様から電話があり、詳しい内容は確認中。', summary: true }));
}

function buildQuestions(a = {}) {
  const choice = (items) => items.map((label) => ({ label, value: label }));
  const qs = [q({ key: 'category', phase: '00 大分類選択', label: '大分類', prompt: 'どの種類の相談ですか？', helper: '分からない場合は「その他」で進めてください。AIは判定せず、すべて本部へ通知します。', type: 'choice', choices: CATEGORIES })];
  if (!a.category) return qs;

  if (a.category === '調剤ミス') qs.push(q({ key: 'errorType', phase: '01 ミス種類選択', label: 'ミスの種類', prompt: 'ミスの種類を選んでください。', helper: '最終判断はホットライン担当が行います。', type: 'choice', choices: choice(ERROR_TYPES) }));

  qs.push(q({ key: 'storeCode', phase: '02 基本情報', label: '店番', prompt: '店番を6桁で入力してください。', helper: '例：000769。半角数字6桁で入力してください。', type: 'text', inputMode: 'numeric', placeholder: '例：000769', validate: (v) => /^\d{6}$/.test(String(v).trim()) ? null : '店番は6桁の数字で入力してください。' }));
  qs.push(q({ key: 'storeName', phase: '02 基本情報', label: '店舗名', prompt: '店舗名を入力してください。', helper: '店番と店舗名は両方必要です。', type: 'text', placeholder: '例：〇〇薬局 △△店' }));

  if (a.category === '調剤ミス') {
    qs.push(q({ key: 'medicalName', phase: '02 基本情報', label: '医療機関名', prompt: '処方元の医療機関名を入力してください。', type: 'text', placeholder: '例：〇〇クリニック' }));
    qs.push(dateQuestion('dosingDate', '03 事象の詳細', '投薬日', '投薬日はいつですか？'));
    qs.push(dateQuestion('discoveryDate', '03 事象の詳細', '発覚日', '発覚日はいつですか？'));
    qs.push(q({ key: 'patientType', phase: '03 事象の詳細', label: '新患/既患', prompt: '患者様は新患・既患のどちらですか？', type: 'choice', choices: choice(['新患（初めて）', '既患', '不明']) }));
    qs.push(q({ key: 'ageGroup', phase: '03 事象の詳細', label: '年齢層', prompt: '患者様の年齢層を選んでください。', type: 'choice', choices: choice(AGE_GROUPS) }));
    qs.push(errorDetailQuestion(a.errorType));
    qs.push(q({ key: 'taken', phase: '04 影響の確認', label: '服用の有無', prompt: '患者様は誤った薬を服用しましたか？', type: 'choice', choices: choice(['服用した', '服用していない', '不明']) }));
    if (a.taken === '服用した') qs.push(q({ key: 'takenCount', phase: '04 影響の確認', label: '服用回数', prompt: '服用回数・服用期間を入力してください。', type: 'text', placeholder: '例：1回服用／2日分服用／不明' }));
    qs.push(q({ key: 'health', phase: '04 影響の確認', label: '健康被害', prompt: '健康被害や症状はありますか？', type: 'choice', choices: choice(['あり（症状あり）', 'なし', '不明']) }));
    if (String(a.health || '').startsWith('あり')) qs.push(q({ key: 'healthDetail', phase: '04 影響の確認', label: '症状詳細', prompt: '症状の内容を分かる範囲で入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：服用後30分ほどで眠気とふらつきが出た。現在は自宅で安静にしている。', summary: true }));
    qs.push(patientReactionQuestion());
    qs.push(discoveryRouteQuestion());
  } else {
    qs.push(dateQuestion('discoveryDate', '03 事象の詳細', '発覚日', '発覚日はいつですか？'));
    if (a.category !== '管理薬剤の紛失') qs.push(patientReactionQuestion());
    appendCategorySpecificQuestions(qs, a.category);
    qs.push(discoveryRouteQuestion());
  }

  qs.push(q({ key: 'currentAction', phase: '06 対応状況', label: '対応状況', prompt: '現在の対応状況を選んでください。', helper: '未対応以外を選ぶと、次に対応内容を確認します。', type: 'choice', choices: choice(ACTION_STATUS) }));
  if (a.currentAction && a.currentAction !== '未対応') qs.push(q({ key: 'actionDetail', phase: '06 対応状況', label: '対応内容', prompt: '実施済み・実施予定の対応内容を入力してください。', helper: '15文字以上の場合、読みやすい形に要約して確認します。', type: 'textarea', placeholder: '例：患者様へ電話で謝罪し、薬剤交換のため本日18時に来局予定。医師へも報告済み。', summary: true }));
  qs.push(q({ key: 'supplement', phase: '07 補足事項', label: '補足事項', prompt: '他に伝えておきたいことはありますか？', helper: '任意です。なければ空欄のまま進めてください。', type: 'textarea', required: false, placeholder: '例：患者様のご家族にも連絡済み。PSVには未連絡。' }));
  return qs;
}

function isAnswered(question, answers) {
  if (question.required === false) return Object.prototype.hasOwnProperty.call(answers, question.key);
  const value = answers[question.key];
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function findNextUnanswered(answers, fromKey) {
  const qs = buildQuestions(answers);
  const start = fromKey ? Math.max(qs.findIndex((item) => item.key === fromKey) + 1, 0) : 0;
  for (let i = start; i < qs.length; i += 1) if (!isAnswered(qs[i], answers)) return qs[i].key;
  for (let i = 0; i < qs.length; i += 1) if (!isAnswered(qs[i], answers)) return qs[i].key;
  return null;
}

function pruneAnswers(inputAnswers, changedKey) {
  let next = { ...inputAnswers };
  if (changedKey === 'category') {
    next = { category: next.category, storeCode: next.storeCode, storeName: next.storeName };
    Object.keys(next).forEach((key) => next[key] === undefined && delete next[key]);
  }
  if (changedKey === 'errorType') delete next.errorDetail;
  if (changedKey === 'taken' && next.taken !== '服用した') delete next.takenCount;
  if (changedKey === 'health' && !String(next.health || '').startsWith('あり')) delete next.healthDetail;
  if (changedKey === 'currentAction' && next.currentAction === '未対応') delete next.actionDetail;
  const allowed = new Set(buildQuestions(next).map((item) => item.key));
  Object.keys(next).forEach((key) => !allowed.has(key) && delete next[key]);
  return next;
}

function summarizeText(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n').trim();
  ['えーっと', 'えっと', 'あのー', 'あの、', 'その、', 'そのー', 'なんというか', 'ちょっと', '少し', 'たぶん', 'おそらく', '一応', 'とりあえず'].forEach((word) => {
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
  if (text.length > 260) text = `${text.slice(0, 240)}…`;
  if (text && !/[。！？!?]$/.test(text)) text += '。';
  return text;
}

function formatAnswer(key, value) {
  const text = String(value ?? '').trim();
  if (key === 'supplement' && text === '') return 'なし';
  return text || '未入力';
}

function classification(answers) {
  if (answers.category === '調剤ミス' && answers.errorType) return `${answers.category} / ${answers.errorType}`;
  return answers.category || '-';
}

function eventDetailText(a) {
  if (a.category === '調剤ミス') return a.errorDetail || '-';
  if (a.category === '個人情報漏洩') return [a.leakType, a.leakDetail, a.recoveryStatus].filter(Boolean).join(' / ') || '-';
  if (a.category === '管理薬剤の紛失') return [a.controlledType, a.drugNameQty, a.searchStatus].filter(Boolean).join(' / ') || '-';
  if (a.category === 'クレーム') return [a.claimType, a.claimDetail, a.escalationRisk].filter(Boolean).join(' / ') || '-';
  if (a.category === '事故') return [a.accidentType, a.injury, a.accidentDetail].filter(Boolean).join(' / ') || '-';
  if (a.category === '法令遵守違反') return [a.violationType, a.violationDetail].filter(Boolean).join(' / ') || '-';
  return a.otherDetail || '-';
}

function riskMentionNeeded(a) {
  return a.category === '個人情報漏洩' || a.category === '管理薬剤の紛失' || a.category === '法令遵守違反' || a.category === '事故' || String(a.health || '').startsWith('あり');
}

function buildSlackMessage(app) {
  const a = app.answers;
  const mentions = ['@PSV', '@営業部長', '@統括部長'];
  if (riskMentionNeeded(a)) mentions.push('@リスク担当');
  return [
    '【ホットライン報告】',
    `受付番号：${app.ticketId}`,
    `メンション：${mentions.join(' ')}`,
    '',
    `分類：${classification(a)}`,
    `店舗：${a.storeCode || '-'} ${a.storeName || ''}`.trim(),
    `医療機関名：${a.medicalName || '-'}`,
    `投薬日：${a.dosingDate || '-'}`,
    `発覚日：${a.discoveryDate || '-'}`,
    `新患/既患：${a.patientType || '-'}`,
    `年齢層：${a.ageGroup || '-'}`,
    '',
    `正/誤・事象詳細：${eventDetailText(a)}`,
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
  ].join('\n');
}

function buildSheetRow(app) {
  const a = app.answers;
  const started = new Date(app.startedAt);
  return [
    app.ticketId,
    formatDate(started),
    `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
    a.storeCode || '', a.storeName || '', a.medicalName || '', a.dosingDate || '', a.discoveryDate || '',
    a.patientType || '', a.ageGroup || '', classification(a), 'HL担当入力', a.errorDetail || eventDetailText(a),
    a.taken || '', a.takenCount || '', a.health || '', a.healthDetail || '', a.patientReaction || '',
    a.discoveryRoute || '', a.currentAction || '', a.actionDetail || '', a.supplement || '', app.sent ? '通知済み' : '未通知', app.sent ? '受付済' : '未送信'
  ];
}

export default function HotlineAIAgentV3() {
  const [app, setApp] = useState(loadState);
  const [draft, setDraft] = useState('');
  const questions = useMemo(() => buildQuestions(app.answers), [app.answers]);
  const currentQuestion = questions.find((item) => item.key === app.currentKey) || questions.find((item) => !isAnswered(item, app.answers)) || questions[0];
  const answeredRows = questions.filter((item) => isAnswered(item, app.answers));
  const done = questions.filter((item) => isAnswered(item, app.answers)).length;
  const progress = Math.max(6, Math.round((done / Math.max(questions.length, 1)) * 100));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(app)); } catch { /* noop */ }
  }, [app]);

  useEffect(() => {
    if (currentQuestion) setDraft(app.answers[currentQuestion.key] || '');
  }, [currentQuestion?.key, app.mode]);

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setApp(initialState());
  }

  function validate(question, value) {
    const text = String(value ?? '').trim();
    if (question.required !== false && !text) return `${question.label}を入力してください。`;
    if (typeof question.validate === 'function') return question.validate(text);
    return null;
  }

  function submitAnswer(rawValue) {
    const question = currentQuestion;
    const value = String(rawValue ?? '').trim();
    const error = validate(question, value);
    if (error) return setApp((prev) => ({ ...prev, error }));

    const nextAnswers = pruneAnswers({ ...app.answers, [question.key]: value }, question.key);
    const summary = summarizeText(value);
    if (question.summary && value.length >= 15 && summary && summary !== value) {
      setApp((prev) => ({
        ...prev,
        answers: nextAnswers,
        mode: 'summary',
        pendingSummary: { key: question.key, label: question.label, original: value, summary, context: prev.editContext },
        editContext: null,
        error: null
      }));
      return;
    }
    navigateAfterAnswer(question.key, nextAnswers, app.editContext);
  }

  function navigateAfterAnswer(answeredKey, nextAnswers, context) {
    if (context?.origin === 'review') {
      setApp((prev) => ({ ...prev, answers: nextAnswers, mode: 'review', editContext: null, error: null }));
      return;
    }
    const nextKey = findNextUnanswered(nextAnswers, answeredKey);
    setApp((prev) => ({
      ...prev,
      answers: nextAnswers,
      currentKey: nextKey || answeredKey,
      mode: nextKey ? 'question' : 'review',
      editContext: null,
      error: null
    }));
  }

  function commitSummary(mode) {
    const pending = app.pendingSummary;
    if (!pending) return;
    if (mode === 'rewrite') {
      setApp((prev) => ({ ...prev, mode: pending.context ? 'editQuestion' : 'question', currentKey: pending.key, editContext: pending.context, pendingSummary: null }));
      return;
    }
    const adopted = mode === 'summary' ? pending.summary : pending.original;
    const nextAnswers = pruneAnswers({ ...app.answers, [pending.key]: adopted }, pending.key);
    navigateAfterAnswer(pending.key, nextAnswers, pending.context);
    setApp((prev) => ({
      ...prev,
      answers: nextAnswers,
      pendingSummary: null,
      meta: { summaries: { ...(prev.meta?.summaries || {}), [pending.key]: { original: pending.original, summary: pending.summary, adopted: mode } } }
    }));
  }

  function startEdit(key, origin) {
    setApp((prev) => ({ ...prev, mode: 'editQuestion', currentKey: key, editContext: { origin, returnKey: prev.currentKey }, error: null }));
  }

  function submitReport() {
    setApp((prev) => ({ ...prev, sent: true, submittedAt: new Date().toISOString(), mode: 'done', error: null }));
  }

  function renderHeader() {
    const store = app.answers.storeCode && app.answers.storeName ? `${app.answers.storeCode} ${app.answers.storeName}` : app.answers.storeCode || app.answers.storeName || '未入力';
    return (
      <>
        <header className="hl-top">
          <div className="hl-brand"><div className="hl-mark">HL</div><div><h1>ホットラインAIエージェント</h1><p>選択中心で本部相談に必要な情報を整理します。</p></div></div>
          <button className="hl-phone" type="button" onClick={() => alert('実運用では社内ホットライン番号へ発信します。')}>電話相談に切替</button>
        </header>
        <div className="hl-status"><span>分類：<b>{app.answers.category || '未選択'}</b></span><span>店舗：<b>{store}</b></span><span>送信方針：<b>全件Slack通知・AI判定なし</b></span></div>
        <progress className="hl-progress" value={done} max={Math.max(questions.length, 1)} aria-label="input progress" />
      </>
    );
  }

  function renderQuestion() {
    const q = currentQuestion;
    const choices = q.type === 'choice' ? q.choices.map((choice) => typeof choice === 'string' ? { label: choice, value: choice } : choice) : [];
    return (
      <>
        {done > 0 && app.mode !== 'editQuestion' && <button className="hl-link" type="button" onClick={() => setApp((prev) => ({ ...prev, mode: 'editList', editContext: { origin: 'progress', returnKey: prev.currentKey } }))}>← 前の回答を修正する</button>}
        {app.mode === 'editQuestion' && <div className="hl-notice">この項目だけ修正します。保存後は元の画面に戻ります。</div>}
        <section className="hl-bubble"><span>{q.phase}</span><h2>{q.prompt}</h2>{q.helper && <p>{q.helper}</p>}</section>
        {q.type === 'choice' ? (
          <div className="hl-choices">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => submitAnswer(choice.value)}><b>{choice.label}</b>{choice.sub && <small>{choice.sub}</small>}</button>)}</div>
        ) : (
          <form className="hl-form" onSubmit={(event) => { event.preventDefault(); submitAnswer(draft); }}>
            <label>{q.label}</label>
            {q.type === 'textarea' ? <textarea value={draft} placeholder={q.placeholder} onChange={(event) => setDraft(event.target.value)} /> : <input value={draft} inputMode={q.inputMode || 'text'} placeholder={q.placeholder} onChange={(event) => setDraft(event.target.value)} />}
            <div className="hl-actions"><button className="hl-primary" type="submit">次へ</button>{q.required === false && <button type="button" onClick={() => submitAnswer('')}>なし・空欄で進む</button>}</div>
          </form>
        )}
        {app.error && <div className="hl-error">{app.error}</div>}
      </>
    );
  }

  function renderSummary() {
    const p = app.pendingSummary;
    return (
      <>
        <section className="hl-bubble"><span>AI要約確認</span><h2>この内容で記録してよいですか？</h2><p>事実が変わっていないか確認してください。</p></section>
        <div className="hl-summary"><div><h3>元の入力</h3><p>{p.original}</p></div><div><h3>要約案</h3><p>{p.summary}</p></div></div>
        <div className="hl-actions"><button className="hl-primary" type="button" onClick={() => commitSummary('summary')}>要約を採用</button><button type="button" onClick={() => commitSummary('original')}>元の文のまま採用</button><button type="button" onClick={() => commitSummary('rewrite')}>書き直す</button></div>
      </>
    );
  }

  function renderReview() {
    const slack = buildSlackMessage(app);
    const sheet = buildSheetRow(app);
    return (
      <>
        <div className="hl-notice">内容を確認してください。確定するとSlack通知と管理表記入のモック処理を実行します。</div>
        <section className="hl-bubble"><span>08 入力内容の確認</span><h2>この内容で本部へ相談します。</h2><p>修正したい項目だけ編集できます。</p></section>
        <div className="hl-review">{answeredRows.map((row) => <div key={row.key}><b>{row.label}</b><p>{formatAnswer(row.key, app.answers[row.key])}</p><button type="button" onClick={() => startEdit(row.key, 'review')}>修正</button></div>)}</div>
        <details><summary>Slack通知プレビュー</summary><pre>{slack}</pre></details>
        <details><summary>管理表24列プレビュー</summary><table><tbody>{SHEET_COLUMNS.map((name, index) => <tr key={name}><th>{index + 1}. {name}</th><td>{sheet[index]}</td></tr>)}</tbody></table></details>
        <div className="hl-actions"><button className="hl-primary" type="button" onClick={submitReport}>この内容で本部へ送信する</button><button type="button" onClick={() => setApp((prev) => ({ ...prev, mode: 'editList', editContext: { origin: 'review' } }))}>修正する</button></div>
      </>
    );
  }

  function renderEditList() {
    const origin = app.editContext?.origin || 'progress';
    return (
      <>
        <section className="hl-bubble"><span>修正機能</span><h2>修正する項目を選んでください。</h2><p>分類変更時は関連項目だけ聞き直します。</p></section>
        <div className="hl-editgrid">{answeredRows.map((row) => <button key={row.key} type="button" onClick={() => startEdit(row.key, origin)}><b>{row.label}</b><small>{formatAnswer(row.key, app.answers[row.key])}</small></button>)}</div>
        <div className="hl-actions"><button type="button" onClick={() => setApp((prev) => ({ ...prev, mode: origin === 'review' ? 'review' : 'question' }))}>戻る</button></div>
      </>
    );
  }

  function renderDone() {
    return (
      <div className="hl-done"><div className="hl-check">✓</div><h2>本部への相談を受け付けました</h2><p>Slack通知と管理表記入のモック処理が完了しました。PSVまたは営業部長から店舗へ電話連絡があります。</p><div className="hl-notice">受付番号：<b>{app.ticketId}</b><br />Slack通知：通知済み ／ 管理表：記入済み</div><div className="hl-actions"><button className="hl-primary" type="button" onClick={reset}>別件を報告する</button><button type="button" onClick={() => setApp((prev) => ({ ...prev, mode: 'review' }))}>通知内容を確認する</button></div></div>
    );
  }

  return (
    <div className="hl-root">
      <main className="hl-shell">
        {renderHeader()}
        <div className="hl-panel">
          {app.mode === 'summary' ? renderSummary() : app.mode === 'review' ? renderReview() : app.mode === 'editList' ? renderEditList() : app.mode === 'done' ? renderDone() : renderQuestion()}
        </div>
        {app.mode !== 'done' && <button className="hl-clear" type="button" onClick={() => window.confirm('下書きを破棄しますか？') && reset()}>下書きを破棄</button>}
      </main>
    </div>
  );
}

