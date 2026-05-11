const { useEffect, useMemo, useRef, useState } = React;

const CATEGORY_OPTIONS = [
  { value: '調剤ミス', label: '調剤ミス', description: '薬の間違い・数量間違い・渡し忘れなど' },
  { value: '個人情報漏洩', label: '個人情報漏洩', description: '処方せん・お薬手帳・書類などの渡し間違い' },
  { value: '管理薬剤の紛失', label: '管理薬剤の紛失', description: '麻薬・覚醒剤原料・向精神薬などの紛失' },
  { value: 'クレーム', label: 'クレーム', description: '患者様・ご家族・医療機関からの苦情' },
  { value: '事故', label: '事故', description: '車両事故・針刺し事故・店舗内事故など' },
  { value: '法令遵守違反', label: '法令遵守違反', description: '法令違反・偽造処方せん・不適切な取扱いなど' },
  { value: 'その他', label: 'その他', description: '上記に当てはまらない内容' },
];

const MISTAKE_OPTIONS = [
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
  'その他',
].map((value) => ({ value, label: value }));

const AGE_OPTIONS = [
  '10歳未満',
  '10代',
  '20代',
  '30代',
  '40代',
  '50代',
  '60代',
  '70代',
  '80代以上',
  '不明',
].map((value) => ({ value, label: value }));

const PATIENT_STATE_OPTIONS = [
  { value: 'お怒り', label: 'お怒り', description: '強い不満・苦情が出ている' },
  { value: '体調不良', label: '体調不良', description: '体調の変化や不調がある' },
  { value: '不安', label: '不安', description: '不安・心配を訴えている' },
  { value: '問題なし', label: '問題なし', description: '現時点で大きな問題はない' },
  { value: '未接触', label: '未接触', description: 'まだ患者様へ連絡できていない' },
];

const DISCOVERY_ROUTE_OPTIONS = [
  { value: '薬局内で発見', label: '薬局内で発見' },
  { value: '患者様からの連絡で発覚', label: '患者様からの連絡で発覚' },
  { value: '医療機関からの連絡で発覚', label: '医療機関からの連絡で発覚' },
  { value: 'その他', label: 'その他' },
];

const ACTION_OPTIONS = [
  { value: '未対応', label: '未対応', description: 'まだ具体的な対応は始めていない' },
  { value: '対応中', label: '対応中', description: '現在、患者様・医療機関などへ対応している' },
  { value: '対応予定あり', label: '対応予定あり', description: 'この後、対応する予定がある' },
  { value: '対応済み', label: '対応済み', description: 'すでに対応が完了している' },
];

const SUMMARY_KEYS = new Set([
  'right_wrong',
  'health_detail',
  'privacy_detail',
  'complaint_detail',
  'accident_detail',
  'compliance_detail',
  'other_detail',
  'action_detail',
]);

const FLOW_LABELS = {
  category: '大分類',
  mistake_type: 'ミスの種類',
  store_code: '店番',
  store_name: '店舗名',
  medical_institution: '医療機関名',
  dispensed_date: '投薬日',
  discovery_date: '発覚日',
  patient_type: '新患／既患',
  age_group: '年齢層',
  right_wrong: '事象の内容',
  taken: '服用の有無',
  taken_count: '服用回数',
  health: '健康被害',
  health_detail: '症状詳細',
  patient_state: '患者様の状態・反応',
  discovery_route: '発覚経緯',
  current_action: '対応状況',
  action_detail: '対応内容',
  supplement: '補足事項',
  privacy_info_type: '漏洩した情報の種類',
  privacy_detail: '個人情報漏洩の内容',
  recovery_status: '回収状況',
  controlled_drug_type: '薬剤の種類',
  lost_drug_detail: '薬剤名と数量',
  search_status: '捜索状況',
  complaint_type: 'クレーム分類',
  complaint_detail: 'クレーム内容',
  escalation_risk: '二次クレーム発展リスク',
  accident_type: '事故の種類',
  injury: 'けが人の有無',
  accident_detail: '事故の概要',
  compliance_type: '違反の種類',
  compliance_detail: '法令違反の内容',
  other_detail: 'その他の状況',
};

const SHEET_COLUMNS = [
  'No.',
  '起票日',
  '時刻',
  '店番',
  '店名',
  '医療機関名',
  '投薬日',
  '発覚日',
  '新患/既患',
  '年齢層',
  '分類',
  'ミスレベル',
  '正/誤',
  '服用有無',
  '服用回数',
  '健康被害',
  '症状詳細',
  '患者状態',
  '発覚経緯',
  '対応状況',
  '対応内容',
  '補足事項',
  'Slack通知',
  'ステータス',
];

let messageSequence = 0;
const nextId = () => `msg-${Date.now()}-${messageSequence++}`;

function asOptions(values) {
  return values.map((value) => ({ value, label: value }));
}

function q(key, answers) {
  const category = answers.category;
  const mistakeType = answers.mistake_type;

  const base = {
    key,
    title: FLOW_LABELS[key] || key,
    required: true,
    source: '店舗入力',
  };

  switch (key) {
    case 'category':
      return {
        ...base,
        type: 'choice',
        title: 'まず、内容に一番近いものを選んでください',
        prompt:
          'AIが重大度を判定することはありません。選んだ内容は、全件ホットラインへ共有されます。分かる範囲で選べば大丈夫です。',
        options: CATEGORY_OPTIONS,
      };
    case 'mistake_type':
      return {
        ...base,
        type: 'choice',
        title: '調剤ミスの種類を選んでください',
        prompt:
          '一番近いものを選んでください。完全に一致しない場合は「その他」で構いません。',
        options: MISTAKE_OPTIONS,
      };
    case 'store_code':
      return {
        ...base,
        type: 'text',
        title: '店番を入力してください',
        prompt: '6桁の数字で入力してください。例のように、先頭が0でもそのまま入力できます。',
        placeholder: '例：000769',
        inputMode: 'numeric',
        validate: (v) => (/^\d{6}$/.test(v.trim()) ? null : '店番は6桁の数字で入力してください。例：000769'),
      };
    case 'store_name':
      return {
        ...base,
        type: 'text',
        title: '店舗名を入力してください',
        prompt: '店舗名を分かる範囲で入力してください。正式名称が分かる場合は正式名称でお願いします。',
        placeholder: '例：〇〇薬局 △△店',
      };
    case 'medical_institution':
      return {
        ...base,
        type: 'text',
        title: '処方元の医療機関名を入力してください',
        prompt: '医療機関名を入力してください。分かる範囲で大丈夫です。',
        placeholder: '例：〇〇クリニック',
      };
    case 'dispensed_date':
      return {
        ...base,
        type: 'choice',
        title: '投薬日はいつですか',
        prompt: '正確な日付が分からない場合は、近いものを選んでください。',
        options: asOptions(['本日', '昨日', '2〜7日前', '8〜14日前', 'それ以前', '不明']),
      };
    case 'discovery_date':
      return {
        ...base,
        type: 'choice',
        title: '発覚日はいつですか',
        prompt: 'いつ分かったかを選んでください。正確でなくても構いません。',
        options: asOptions(['本日', '昨日', '2〜7日前', '8〜14日前', 'それ以前', '不明']),
      };
    case 'patient_type':
      return {
        ...base,
        type: 'choice',
        title: '患者様は新患・既患のどちらですか',
        prompt: '分からない場合は「不明」を選んでください。',
        options: asOptions(['新患（初めて）', '既患', '不明']),
      };
    case 'age_group':
      return {
        ...base,
        type: 'choice',
        title: '患者様の年齢層を選んでください',
        prompt: 'おおよその年代で構いません。',
        options: AGE_OPTIONS,
      };
    case 'right_wrong': {
      if (mistakeType === '渡し忘れ') {
        return {
          ...base,
          type: 'textarea',
          title: '渡し忘れた薬剤について入力してください',
          prompt: '薬剤名、数量、分かっている状況を入力してください。短くても大丈夫です。',
          placeholder: '例：〇〇錠を1シート渡し忘れた可能性があります。',
          summarize: false,
          rows: 4,
        };
      }
      if (mistakeType === '異薬異物混入') {
        return {
          ...base,
          type: 'textarea',
          title: '本来の薬剤と、混入していたものを入力してください',
          prompt: '本来入るはずだった薬剤と、実際に混入していた薬剤・異物を分かる範囲で入力してください。',
          placeholder: '例：本来はA錠。実際にはB錠が混入していた。',
          summarize: false,
          rows: 5,
        };
      }
      if (mistakeType === '別患者への投薬') {
        return {
          ...base,
          type: 'textarea',
          title: '本来の患者様と、実際に渡した患者様を入力してください',
          prompt: '個人名を避けたい場合は、患者A・患者Bのような表現でも構いません。',
          placeholder: '例：患者A様分を、患者B様へ渡してしまった可能性があります。',
          summarize: false,
          rows: 5,
        };
      }
      if (mistakeType === '疑義照会漏れ') {
        return {
          ...base,
          type: 'textarea',
          title: '疑義照会漏れの内容を入力してください',
          prompt: '文章を整える必要はありません。AIがあとで短く整理し、確認してから記録します。',
          placeholder: '例：用量が通常より多い可能性があったが、疑義照会を行わずに投薬してしまった。',
          summarize: true,
          rows: 5,
        };
      }
      return {
        ...base,
        type: 'textarea',
        title: '本来の内容と、実際の内容を入力してください',
        prompt: '「本来は〇〇、実際は△△」の形で入力すると整理しやすくなります。',
        placeholder: '例：本来はA錠10mg。実際はA錠5mgをお渡しした。',
        summarize: false,
        rows: 5,
      };
    }
    case 'taken':
      return {
        ...base,
        type: 'choice',
        title: '患者様は服用しましたか',
        prompt: '分からない場合は「不明」を選んでください。服用した場合だけ、次に回数を確認します。',
        options: asOptions(['服用した', '服用していない', '不明']),
      };
    case 'taken_count':
      return {
        ...base,
        type: 'text',
        title: '服用回数を入力してください',
        prompt: '何回、何日分など、分かる範囲で入力してください。',
        placeholder: '例：1回服用、2日分服用、朝夕2回など',
      };
    case 'health':
      return {
        ...base,
        type: 'choice',
        title: '健康被害や症状はありますか',
        prompt: '今分かっている範囲で選んでください。「あり」の場合だけ、次に症状を確認します。',
        options: asOptions(['あり（症状あり）', 'なし', '不明']),
      };
    case 'health_detail':
      return {
        ...base,
        type: 'textarea',
        title: '症状の内容を入力してください',
        prompt: '文章を整える必要はありません。症状・発生時刻・対応状況などを分かる範囲で入力してください。',
        placeholder: '例：服用後にめまいを訴えた。現在は自宅で様子を見ている。',
        summarize: true,
        rows: 5,
      };
    case 'patient_state':
      return {
        ...base,
        type: 'choice',
        title: '患者様の現在の状態・反応を選んでください',
        prompt: '一番近いものを選んでください。複数ある場合は、いま最も注意が必要なものを選んでください。',
        options: PATIENT_STATE_OPTIONS,
      };
    case 'discovery_route':
      return {
        ...base,
        type: 'choice',
        title: 'どのように発覚しましたか',
        prompt: '発覚したきっかけを選んでください。',
        options: DISCOVERY_ROUTE_OPTIONS,
      };
    case 'current_action':
      return {
        ...base,
        type: 'choice',
        title: '現在の対応状況を選んでください',
        prompt: '未対応以外を選んだ場合だけ、次に対応内容を確認します。',
        options: ACTION_OPTIONS,
      };
    case 'action_detail':
      return {
        ...base,
        type: 'textarea',
        title: '対応内容を入力してください',
        prompt: '患者様・医療機関・社内への連絡状況などを入力してください。AIが短く整理し、確認してから記録します。',
        placeholder: '例：患者様へ電話連絡し、状況を説明。医師へ確認予定。',
        summarize: true,
        rows: 5,
      };
    case 'supplement':
      return {
        ...base,
        type: 'textarea',
        title: '他に伝えておきたいことはありますか',
        prompt: '任意です。なければ空欄のまま「次へ進む」を押してください。',
        placeholder: '例：特になし。不安な点、伝達事項、補足など。',
        required: false,
        rows: 4,
      };
    case 'privacy_info_type':
      return {
        ...base,
        type: 'choice',
        title: '漏洩した情報の種類を選んでください',
        prompt: '一番近いものを選んでください。',
        options: asOptions(['処方せん', 'お薬手帳', '薬袋・薬情', '会計書類', '患者情報画面', 'その他', '不明']),
      };
    case 'privacy_detail':
      return {
        ...base,
        type: 'textarea',
        title: '個人情報漏洩の具体的な内容を入力してください',
        prompt: '文章を整える必要はありません。誰に何が渡ったか、回収できたかなどを分かる範囲で入力してください。',
        placeholder: '例：別患者様のお薬手帳を誤ってお渡しした。現在回収を依頼中。',
        summarize: true,
        rows: 5,
      };
    case 'recovery_status':
      return {
        ...base,
        type: 'choice',
        title: '回収状況を選んでください',
        prompt: '対象物がある場合、現在の回収状況を教えてください。',
        options: asOptions(['回収済み', '回収中', '未回収', '回収対象なし', '不明']),
      };
    case 'controlled_drug_type':
      return {
        ...base,
        type: 'choice',
        title: '紛失した管理薬剤の種類を選んでください',
        prompt: '一番近いものを選んでください。患者様の状態はこのカテゴリでは聞きません。',
        options: asOptions(['麻薬', '覚醒剤原料', '向精神薬', '毒薬・劇薬', 'その他管理薬剤', '不明']),
      };
    case 'lost_drug_detail':
      return {
        ...base,
        type: 'textarea',
        title: '薬剤名と数量を入力してください',
        prompt: '分かる範囲で、薬剤名・規格・数量を入力してください。',
        placeholder: '例：〇〇錠10mg 10錠が所在不明。',
        rows: 4,
      };
    case 'search_status':
      return {
        ...base,
        type: 'choice',
        title: '捜索状況を選んでください',
        prompt: '現在の状況に一番近いものを選んでください。',
        options: asOptions(['捜索中', '発見済み', '未捜索', '棚卸・記録確認中', '不明']),
      };
    case 'complaint_type':
      return {
        ...base,
        type: 'choice',
        title: 'クレームの分類を選んでください',
        prompt: '一番近いものを選んでください。',
        options: asOptions(['接遇・態度', '待ち時間', '説明不足', '会計', '薬剤・調剤内容', '設備・環境', 'その他']),
      };
    case 'complaint_detail':
      return {
        ...base,
        type: 'textarea',
        title: 'クレームの内容を入力してください',
        prompt: '相手の発言をそのまま整理せず入力しても大丈夫です。AIが短く整えて確認します。',
        placeholder: '例：待ち時間が長く、説明も不足していると強くお怒りだった。',
        summarize: true,
        rows: 5,
      };
    case 'escalation_risk':
      return {
        ...base,
        type: 'choice',
        title: '二次クレームに発展しそうですか',
        prompt: '判断が難しければ「不明」を選んでください。AIは判定せず、全件共有します。',
        options: asOptions(['可能性あり', '可能性低い', 'すでに発展している', '不明']),
      };
    case 'accident_type':
      return {
        ...base,
        type: 'choice',
        title: '事故の種類を選んでください',
        prompt: '一番近いものを選んでください。',
        options: asOptions(['車両事故', '針刺し事故', '転倒・転落', '店舗設備による事故', '配送・訪問中の事故', 'その他']),
      };
    case 'injury':
      return {
        ...base,
        type: 'choice',
        title: 'けが人はいますか',
        prompt: '分かる範囲で選んでください。',
        options: asOptions(['あり', 'なし', '不明']),
      };
    case 'accident_detail':
      return {
        ...base,
        type: 'textarea',
        title: '事故の概要を入力してください',
        prompt: 'いつ・どこで・何が起きたかを分かる範囲で入力してください。AIが短く整理します。',
        placeholder: '例：店舗駐車場で社用車を後退中、柱に接触した。けが人なし。',
        summarize: true,
        rows: 5,
      };
    case 'compliance_type':
      return {
        ...base,
        type: 'choice',
        title: '違反の種類を選んでください',
        prompt: '一番近いものを選んでください。判断が難しい場合は「その他」で構いません。',
        options: asOptions(['偽造処方せん', '薬機法関連', '個人情報取扱い', '記録・帳票不備', '不適切な販売・交付', 'その他', '不明']),
      };
    case 'compliance_detail':
      return {
        ...base,
        type: 'textarea',
        title: '法令遵守違反の内容を入力してください',
        prompt: '事実ベースで分かる範囲を入力してください。AIが短く整理し、確認してから記録します。',
        placeholder: '例：偽造処方せんの疑いがある処方せんを受付した。詳細確認中。',
        summarize: true,
        rows: 5,
      };
    case 'other_detail':
      return {
        ...base,
        type: 'textarea',
        title: '状況の概要を入力してください',
        prompt: 'どのカテゴリか分からない内容でも大丈夫です。分かっていることをそのまま入力してください。',
        placeholder: '例：通常と異なる事象があり、ホットラインへ共有したい。',
        summarize: true,
        rows: 5,
      };
    default:
      return {
        ...base,
        type: 'text',
        title: FLOW_LABELS[key] || key,
        prompt: '分かる範囲で入力してください。',
      };
  }
}

function buildFlow(answers) {
  const flow = [q('category', answers)];
  const category = answers.category;
  if (!category) return flow;

  if (category === '調剤ミス') {
    flow.push(q('mistake_type', answers));
  }

  flow.push(q('store_code', answers));
  flow.push(q('store_name', answers));

  if (category === '調剤ミス') {
    flow.push(q('medical_institution', answers));
    flow.push(q('dispensed_date', answers));
    flow.push(q('discovery_date', answers));
    flow.push(q('patient_type', answers));
    flow.push(q('age_group', answers));
    flow.push(q('right_wrong', answers));
    flow.push(q('taken', answers));
    if (answers.taken === '服用した') flow.push(q('taken_count', answers));
    flow.push(q('health', answers));
    if (answers.health === 'あり（症状あり）') flow.push(q('health_detail', answers));
    flow.push(q('patient_state', answers));
    flow.push(q('discovery_route', answers));
    flow.push(q('current_action', answers));
    if (answers.current_action && answers.current_action !== '未対応') flow.push(q('action_detail', answers));
    flow.push(q('supplement', answers));
    return flow;
  }

  flow.push(q('discovery_date', answers));
  if (category !== '管理薬剤の紛失') {
    flow.push(q('patient_state', answers));
  }

  if (category === '個人情報漏洩') {
    flow.push(q('privacy_info_type', answers));
    flow.push(q('privacy_detail', answers));
    flow.push(q('recovery_status', answers));
  }

  if (category === '管理薬剤の紛失') {
    flow.push(q('controlled_drug_type', answers));
    flow.push(q('lost_drug_detail', answers));
    flow.push(q('search_status', answers));
  }

  if (category === 'クレーム') {
    flow.push(q('complaint_type', answers));
    flow.push(q('complaint_detail', answers));
    flow.push(q('escalation_risk', answers));
  }

  if (category === '事故') {
    flow.push(q('accident_type', answers));
    flow.push(q('injury', answers));
    flow.push(q('accident_detail', answers));
  }

  if (category === '法令遵守違反') {
    flow.push(q('compliance_type', answers));
    flow.push(q('compliance_detail', answers));
  }

  if (category === 'その他') {
    flow.push(q('other_detail', answers));
  }

  flow.push(q('current_action', answers));
  if (answers.current_action && answers.current_action !== '未対応') flow.push(q('action_detail', answers));
  flow.push(q('supplement', answers));

  return flow;
}

function getNextQuestion(answers) {
  return buildFlow(answers).find((item) => answers[item.key] === undefined || answers[item.key] === null);
}

function summarizeText(input) {
  const original = input.trim();
  let text = original;

  const replacements = [
    [/えーっと|えっと|あのー|あの、|その、|なんというか/g, ''],
    [/ちょっと|少し/g, ''],
    [/という感じで|みたいな|と思います|かもしれません/g, ''],
    [/ですね、|ですが、|なんですが/g, '。'],
    [/\s+/g, ' '],
    [/、+/g, '、'],
    [/。+/g, '。'],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .split(/[。\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('。');

  if (text && !/[。.!?？]$/.test(text)) text += '。';

  if (text.length > 130) {
    const sentences = text.split('。').map((part) => part.trim()).filter(Boolean);
    const picked = [];
    for (const sentence of sentences) {
      if ((picked.join('。').length + sentence.length) <= 120 || picked.length === 0) picked.push(sentence);
    }
    text = picked.join('。') + '。';
  }

  return text || original;
}

function validateAnswer(question, value) {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  const trimmed = raw.trim();

  if (question.required !== false && !trimmed) {
    return 'ここは入力が必要です。分かる範囲で入力してください。';
  }
  if (question.validate) return question.validate(raw);
  return null;
}

function cleanupAnswers(nextAnswers, previousAnswers, changedKey) {
  let cleaned = { ...nextAnswers };

  if (changedKey === 'category' && previousAnswers.category && previousAnswers.category !== cleaned.category) {
    cleaned = {
      category: cleaned.category,
      ...(previousAnswers.store_code ? { store_code: previousAnswers.store_code } : {}),
      ...(previousAnswers.store_name ? { store_name: previousAnswers.store_name } : {}),
    };
  }

  if (changedKey === 'mistake_type' && previousAnswers.mistake_type && previousAnswers.mistake_type !== cleaned.mistake_type) {
    delete cleaned.right_wrong;
  }

  if (cleaned.taken !== '服用した') delete cleaned.taken_count;
  if (cleaned.health !== 'あり（症状あり）') delete cleaned.health_detail;
  if (cleaned.current_action === '未対応') delete cleaned.action_detail;

  const validKeys = new Set(buildFlow(cleaned).map((item) => item.key));
  Object.keys(cleaned).forEach((key) => {
    if (!validKeys.has(key)) delete cleaned[key];
  });

  return cleaned;
}

function cleanupSources(nextSources, cleanedAnswers) {
  const keys = new Set(Object.keys(cleanedAnswers));
  return Object.fromEntries(Object.entries(nextSources).filter(([key]) => keys.has(key)));
}

function makeInitialMessages() {
  const firstQuestion = q('category', {});
  return [
    {
      id: nextId(),
      role: 'bot',
      type: 'text',
      content:
        'こんにちは。ホットラインへの報告内容を、会話形式で一緒に整理します。選択式が中心です。文章をきれいに書こうとしなくて大丈夫です。',
    },
    {
      id: nextId(),
      role: 'bot',
      type: 'text',
      tone: 'notice',
      content:
        '大切な前提です。AIは重大度やエスカレーション要否を判定しません。すべての報告をホットラインへ共有し、人が確認します。',
    },
    {
      id: nextId(),
      role: 'bot',
      type: 'question',
      question: firstQuestion,
    },
  ];
}

function getQuestionLabel(key, answers) {
  return q(key, answers).title || FLOW_LABELS[key] || key;
}

function buildReviewRows(answers, sources) {
  return buildFlow(answers)
    .filter((item) => answers[item.key] !== undefined && answers[item.key] !== null)
    .map((item) => ({
      key: item.key,
      label: item.title || FLOW_LABELS[item.key] || item.key,
      value: answers[item.key],
      source: sources[item.key] || (SUMMARY_KEYS.has(item.key) ? 'AI要約または店舗入力' : '店舗入力'),
    }));
}

function formatClassification(answers) {
  if (!answers.category) return '未入力';
  if (answers.category === '調剤ミス') {
    return `${answers.category}${answers.mistake_type ? ` / ${answers.mistake_type}` : ''}`;
  }
  return answers.category;
}

function dash(value) {
  return value === undefined || value === null || value === '' ? '対象外・未入力' : value;
}

function buildSlackText(answers) {
  const lines = [
    '【ホットラインAIエージェント報告】',
    '※AIは重大度判定を行っていません。全件、人が確認します。',
    '',
    `分類：${formatClassification(answers)}`,
    `店番：${dash(answers.store_code)}`,
    `店名：${dash(answers.store_name)}`,
    `医療機関名：${dash(answers.medical_institution)}`,
    `投薬日：${dash(answers.dispensed_date)}`,
    `発覚日：${dash(answers.discovery_date)}`,
    `新患/既患：${dash(answers.patient_type)}`,
    `年齢層：${dash(answers.age_group)}`,
    `正/誤・事象内容：${dash(answers.right_wrong || answers.privacy_detail || answers.lost_drug_detail || answers.complaint_detail || answers.accident_detail || answers.compliance_detail || answers.other_detail)}`,
    `服用有無：${dash(answers.taken)}`,
    `服用回数：${dash(answers.taken_count)}`,
    `健康被害：${dash(answers.health)}`,
    `症状詳細：${dash(answers.health_detail)}`,
    `患者状態：${dash(answers.patient_state)}`,
    `発覚経緯：${dash(answers.discovery_route)}`,
    `対応状況：${dash(answers.current_action)}`,
    `対応内容：${dash(answers.action_detail)}`,
    `補足事項：${dash(answers.supplement)}`,
    '',
    '通知先：#ホットライン報告 / @PSV / @営業部長 / @統括部長 / @リスク担当（該当時）',
  ];

  return lines.join('\n');
}

function buildSheetRow(answers, now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return {
    'No.': '自動採番',
    起票日: `${y}-${m}-${d}`,
    時刻: `${hh}:${mm}`,
    店番: dash(answers.store_code),
    店名: dash(answers.store_name),
    医療機関名: dash(answers.medical_institution),
    投薬日: dash(answers.dispensed_date),
    発覚日: dash(answers.discovery_date),
    '新患/既患': dash(answers.patient_type),
    年齢層: dash(answers.age_group),
    分類: formatClassification(answers),
    ミスレベル: answers.category === '調剤ミス' ? 'HL担当が後で判定' : '対象外',
    '正/誤': dash(answers.right_wrong || answers.privacy_detail || answers.lost_drug_detail || answers.complaint_detail || answers.accident_detail || answers.compliance_detail || answers.other_detail),
    服用有無: dash(answers.taken),
    服用回数: dash(answers.taken_count),
    健康被害: dash(answers.health),
    症状詳細: dash(answers.health_detail),
    患者状態: dash(answers.patient_state),
    発覚経緯: dash(answers.discovery_route),
    対応状況: dash(answers.current_action),
    対応内容: dash(answers.action_detail),
    補足事項: dash(answers.supplement),
    Slack通知: '通知済み（モック）',
    ステータス: '受付済',
  };
}

function HotlineAIAgentV3() {
  const [answers, setAnswers] = useState({});
  const [sources, setSources] = useState({});
  const [messages, setMessages] = useState(makeInitialMessages);
  const [mode, setMode] = useState('answer');
  const [currentKey, setCurrentKey] = useState('category');
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState('');
  const [pendingSummary, setPendingSummary] = useState(null);
  const [fontScale, setFontScale] = useState('normal');
  const [output, setOutput] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const flow = useMemo(() => buildFlow(answers), [answers]);
  const currentQuestion = currentKey ? q(currentKey, answers) : null;
  const answeredRows = useMemo(() => buildReviewRows(answers, sources), [answers, sources]);
  const progressIndex = currentQuestion ? Math.max(1, flow.findIndex((item) => item.key === currentQuestion.key) + 1) : flow.length;
  const progressTotal = Math.max(flow.length, 1);
  const progressPercent = Math.min(100, Math.round((Object.keys(answers).length / progressTotal) * 100));

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, mode, inputError, output]);

  useEffect(() => {
    if ((mode === 'answer' || mode === 'editAnswer') && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [mode, currentKey]);

  function appendBotQuestion(question) {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'bot',
        type: 'question',
        question,
      },
    ]);
  }

  function appendBotText(content, tone = 'normal') {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'bot',
        type: 'text',
        tone,
        content,
      },
    ]);
  }

  function proceed(nextAnswers) {
    const nextQuestion = getNextQuestion(nextAnswers);
    setInputError('');
    setDraft('');

    if (nextQuestion) {
      setMode('answer');
      setCurrentKey(nextQuestion.key);
      appendBotQuestion(nextQuestion);
      return;
    }

    setMode('review');
    setCurrentKey(null);
    appendBotText('入力内容がそろいました。最後に一緒に確認しましょう。間違いがあれば、1項目だけ修正できます。', 'notice');
  }

  function commitAnswer(question, value, source = '店舗入力') {
    const previous = answers;
    const nextRaw = { ...previous, [question.key]: value };
    const cleaned = cleanupAnswers(nextRaw, previous, question.key);
    const nextSourcesRaw = { ...sources, [question.key]: source };
    const cleanedSources = cleanupSources(nextSourcesRaw, cleaned);

    setAnswers(cleaned);
    setSources(cleanedSources);
    proceed(cleaned);
  }

  function submitAnswer(value, displayValue = value) {
    if (!currentQuestion) return;
    const raw = typeof value === 'string' ? value : String(value ?? '');
    const normalized = raw.trim() || (currentQuestion.required === false ? 'なし' : raw.trim());
    const error = validateAnswer(currentQuestion, normalized);

    if (error) {
      setInputError(error);
      return;
    }

    setInputError('');
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        type: 'text',
        content: displayValue || normalized,
      },
    ]);

    if (currentQuestion.summarize && normalized.length >= 15) {
      const summary = summarizeText(normalized);
      if (summary !== normalized) {
        setPendingSummary({
          question: currentQuestion,
          raw: normalized,
          summary,
        });
        setMode('summaryConfirm');
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'bot',
            type: 'summary',
            raw: normalized,
            summary,
          },
        ]);
        return;
      }
    }

    commitAnswer(currentQuestion, normalized, currentQuestion.summarize ? '店舗入力（要約不要）' : '店舗入力');
  }

  function handleSummaryDecision(decision) {
    if (!pendingSummary) return;
    const { question, raw, summary } = pendingSummary;

    if (decision === 'retry') {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', type: 'text', content: '入力し直す' },
        {
          id: nextId(),
          role: 'bot',
          type: 'question',
          question,
          prefix: '承知しました。もう一度、分かる範囲で入力してください。',
        },
      ]);
      setMode('answer');
      setCurrentKey(question.key);
      setDraft(raw);
      setPendingSummary(null);
      return;
    }

    if (decision === 'adopt') {
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', type: 'text', content: '要約を採用する' }]);
      setPendingSummary(null);
      commitAnswer(question, summary, 'AI要約');
      return;
    }

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', type: 'text', content: '元の文章のまま使う' }]);
    setPendingSummary(null);
    commitAnswer(question, raw, '店舗入力（原文）');
  }

  function openEditList() {
    if (answeredRows.length === 0) {
      appendBotText('まだ修正できる回答がありません。まずは最初の質問から進めてください。');
      return;
    }
    setMode('editList');
    setCurrentKey(null);
    setInputError('');
    appendBotText('修正したい項目を選んでください。最初からやり直す必要はありません。', 'notice');
  }

  function beginEdit(key) {
    const editQuestion = q(key, answers);
    setCurrentKey(key);
    setMode('editAnswer');
    setDraft(answers[key] || '');
    setInputError('');
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', type: 'text', content: `${getQuestionLabel(key, answers)}を修正する` },
      {
        id: nextId(),
        role: 'bot',
        type: 'question',
        question: editQuestion,
        prefix: `現在の内容は「${answers[key]}」です。新しい内容を選ぶか入力してください。`,
      },
    ]);
  }

  function cancelEditList() {
    const nextQuestion = getNextQuestion(answers);
    if (nextQuestion) {
      setMode('answer');
      setCurrentKey(nextQuestion.key);
      appendBotQuestion(nextQuestion);
      return;
    }
    setMode('review');
    setCurrentKey(null);
    appendBotText('確認画面に戻ります。内容に問題がなければ共有してください。', 'notice');
  }

  function showPhoneFallback() {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', type: 'text', content: '電話で相談したい' },
      {
        id: nextId(),
        role: 'bot',
        type: 'text',
        tone: 'notice',
        content:
          '不安がある場合は、通常のホットライン電話ルールに従って電話してください。この画面の入力は続けても、中断しても大丈夫です。入力済みの内容は画面内に残ります。',
      },
    ]);
  }

  function confirmReport() {
    const now = new Date();
    const slackText = buildSlackText(answers);
    const sheetRow = buildSheetRow(answers, now);
    setOutput({ slackText, sheetRow });
    setMode('complete');
    setCurrentKey(null);
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', type: 'text', content: 'この内容でホットラインへ共有する' },
      {
        id: nextId(),
        role: 'bot',
        type: 'complete',
        content:
          '受付が完了しました。プロトタイプではSlack通知と管理表記入をモック表示しています。実運用では、この時点で#ホットライン報告へ投稿し、管理表へ自動転記します。',
      },
    ]);
  }

  function resetConversation() {
    setAnswers({});
    setSources({});
    setMessages(makeInitialMessages());
    setMode('answer');
    setCurrentKey('category');
    setDraft('');
    setInputError('');
    setPendingSummary(null);
    setOutput(null);
  }

  async function copySlackText() {
    if (!output?.slackText) return;
    try {
      await navigator.clipboard.writeText(output.slackText);
      appendBotText('Slack通知文をコピーしました。必要に応じて貼り付けて確認できます。', 'success');
    } catch {
      appendBotText('コピーできませんでした。画面上の通知文を選択してコピーしてください。', 'error');
    }
  }

  function renderMessage(message) {
    if (message.type === 'question') {
      const question = message.question;
      return (
        <article key={message.id} className="message-row bot-row">
          <div className="avatar" aria-hidden="true">HL</div>
          <div className="bubble bot-bubble question-bubble">
            {message.prefix && <p className="bubble-prefix">{message.prefix}</p>}
            <p className="small-label">次にお伺いします</p>
            <h2>{question.title}</h2>
            <p>{question.prompt}</p>
            {question.summarize && (
              <div className="safe-note">
                長めの文章はAIが短く整理します。採用前に必ず確認できます。
              </div>
            )}
          </div>
        </article>
      );
    }

    if (message.type === 'summary') {
      return (
        <article key={message.id} className="message-row bot-row">
          <div className="avatar" aria-hidden="true">HL</div>
          <div className="bubble bot-bubble summary-bubble">
            <p className="small-label">AI要約の確認</p>
            <h2>内容を短く整理しました</h2>
            <p>意味が変わっていないか確認してください。違う場合は、元の文章を使うか入力し直せます。</p>
            <div className="summary-box">
              <span>要約案</span>
              <strong>{message.summary}</strong>
            </div>
            <details className="original-text">
              <summary>元の入力を見る</summary>
              <p>{message.raw}</p>
            </details>
          </div>
        </article>
      );
    }

    if (message.type === 'complete') {
      return (
        <article key={message.id} className="message-row bot-row">
          <div className="avatar" aria-hidden="true">HL</div>
          <div className="bubble bot-bubble complete-bubble">
            <p className="small-label">受付完了</p>
            <h2>報告内容を共有しました</h2>
            <p>{message.content}</p>
            <ol className="next-guidance">
              <li>ホットラインのSlackチャンネルに、今回の報告内容が投稿されます。</li>
              <li>PSVまたは営業部長から、店舗へ電話連絡があります。</li>
              <li>対応が完了したら、PSVに完了の連絡をお願いします。</li>
            </ol>
          </div>
        </article>
      );
    }

    const isBot = message.role === 'bot';
    return (
      <article key={message.id} className={`message-row ${isBot ? 'bot-row' : 'user-row'}`}>
        {isBot && <div className="avatar" aria-hidden="true">HL</div>}
        <div className={`bubble ${isBot ? 'bot-bubble' : 'user-bubble'} ${message.tone ? `tone-${message.tone}` : ''}`}>
          {isBot && <p className="speaker">ホットラインAIエージェント</p>}
          <p>{message.content}</p>
        </div>
      </article>
    );
  }

  function renderChoiceControls(question) {
    return (
      <div className="choice-list" role="list" aria-label="回答の選択肢">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice-button"
            onClick={() => submitAnswer(option.value, option.label)}
          >
            <span className="choice-main">{option.label}</span>
            {option.description && <span className="choice-description">{option.description}</span>}
          </button>
        ))}
      </div>
    );
  }

  function renderTextControls(question) {
    const isTextarea = question.type === 'textarea';
    return (
      <form
        className="text-answer-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitAnswer(draft);
        }}
      >
        <label className="composer-label" htmlFor="answer-input">
          {question.required === false ? '任意入力です' : '回答を入力してください'}
        </label>
        {isTextarea ? (
          <textarea
            id="answer-input"
            ref={inputRef}
            value={draft}
            rows={question.rows || 4}
            placeholder={question.placeholder || ''}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <input
            id="answer-input"
            ref={inputRef}
            value={draft}
            inputMode={question.inputMode}
            placeholder={question.placeholder || ''}
            onChange={(event) => setDraft(event.target.value)}
          />
        )}
        <button className="primary-action" type="submit">
          <span>{question.required === false && !draft.trim() ? 'なしで次へ進む' : 'この内容で次へ進む'}</span>
          <strong aria-hidden="true">›</strong>
        </button>
      </form>
    );
  }

  function renderReviewCard() {
    if (mode !== 'review') return null;
    return (
      <article className="message-row bot-row review-row">
        <div className="avatar" aria-hidden="true">HL</div>
        <div className="bubble bot-bubble review-bubble">
          <p className="small-label">最終確認</p>
          <h2>この内容で共有してよろしいですか</h2>
          <p>
            修正したい項目があれば、該当する行を押してください。修正後は、この確認画面に戻ります。
          </p>
          <div className="review-list">
            {answeredRows.map((row) => (
              <button key={row.key} type="button" className="review-item" onClick={() => beginEdit(row.key)}>
                <span className="review-label">{row.label}</span>
                <span className="review-value">{row.value}</span>
                <span className="review-source">{row.source}</span>
              </button>
            ))}
          </div>
          <div className="safe-note">
            ここで共有しても、AIがミスレベルや重大度を判定することはありません。人が内容を確認します。
          </div>
        </div>
      </article>
    );
  }

  function renderOutputCard() {
    if (!output) return null;
    return (
      <article className="message-row bot-row output-row">
        <div className="avatar" aria-hidden="true">HL</div>
        <div className="bubble bot-bubble output-bubble">
          <p className="small-label">送信モック</p>
          <h2>Slack通知・管理表転記の内容</h2>
          <p>以下はプロトタイプ上のモック表示です。実運用ではAPI連携に置き換えます。</p>
          <details open>
            <summary>Slack通知文</summary>
            <pre>{output.slackText}</pre>
          </details>
          <details>
            <summary>管理表24列マッピング</summary>
            <div className="sheet-grid">
              {SHEET_COLUMNS.map((column) => (
                <React.Fragment key={column}>
                  <div className="sheet-key">{column}</div>
                  <div className="sheet-value">{output.sheetRow[column]}</div>
                </React.Fragment>
              ))}
            </div>
          </details>
        </div>
      </article>
    );
  }

  function renderComposer() {
    if (mode === 'summaryConfirm') {
      return (
        <div className="composer-panel">
          <p className="composer-title">要約案を確認してください</p>
          <div className="action-stack">
            <button className="primary-action" type="button" onClick={() => handleSummaryDecision('adopt')}>
              <span>要約を採用する</span>
              <strong aria-hidden="true">›</strong>
            </button>
            <button className="secondary-action" type="button" onClick={() => handleSummaryDecision('keep')}>
              元の文章のまま使う
            </button>
            <button className="secondary-action" type="button" onClick={() => handleSummaryDecision('retry')}>
              入力し直す
            </button>
          </div>
        </div>
      );
    }

    if (mode === 'editList') {
      return (
        <div className="composer-panel edit-panel">
          <p className="composer-title">修正したい項目を選んでください</p>
          <div className="edit-choice-list">
            {answeredRows.map((row) => (
              <button key={row.key} type="button" className="edit-choice" onClick={() => beginEdit(row.key)}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </button>
            ))}
          </div>
          <button className="secondary-action" type="button" onClick={cancelEditList}>
            修正せずに戻る
          </button>
        </div>
      );
    }

    if (mode === 'review') {
      return (
        <div className="composer-panel">
          <p className="composer-title">確認後、下の青いボタンで共有します</p>
          <button className="primary-action" type="button" onClick={confirmReport}>
            <span>この内容でホットラインへ共有する</span>
            <strong aria-hidden="true">›</strong>
          </button>
          <div className="composer-secondary-row">
            <button className="secondary-action" type="button" onClick={openEditList}>内容を修正する</button>
            <button className="secondary-action" type="button" onClick={showPhoneFallback}>電話で相談したい</button>
          </div>
        </div>
      );
    }

    if (mode === 'complete') {
      return (
        <div className="composer-panel">
          <p className="composer-title">受付は完了しています</p>
          <div className="composer-secondary-row">
            <button className="primary-action" type="button" onClick={resetConversation}>
              <span>新しい報告を始める</span>
              <strong aria-hidden="true">›</strong>
            </button>
            <button className="secondary-action" type="button" onClick={copySlackText}>Slack通知文をコピー</button>
          </div>
        </div>
      );
    }

    if (!currentQuestion) return null;

    return (
      <div className="composer-panel">
        <div className="composer-topline">
          <p className="composer-title">ここが操作する場所です</p>
          <span>{progressIndex}/{progressTotal}</span>
        </div>
        {inputError && <div className="input-error" role="alert">{inputError}</div>}
        {currentQuestion.type === 'choice' ? renderChoiceControls(currentQuestion) : renderTextControls(currentQuestion)}
        <div className="composer-secondary-row">
          {answeredRows.length > 0 && (
            <button className="secondary-action" type="button" onClick={openEditList}>前の回答を修正する</button>
          )}
          <button className="secondary-action" type="button" onClick={showPhoneFallback}>電話で相談したい</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`hotline-root ${fontScale === 'large' ? 'large-text' : ''}`}>
      <style>{styles}</style>
      <section className="chat-shell" aria-label="ホットラインAIエージェント チャット画面">
        <header className="chat-header">
          <div className="header-main">
            <div className="header-avatar" aria-hidden="true">HL</div>
            <div>
              <h1>ホットラインAIエージェント</h1>
              <p>会話で報告内容を整理します</p>
            </div>
          </div>
          <div className="header-actions">
            <button type="button" onClick={() => setFontScale(fontScale === 'large' ? 'normal' : 'large')}>
              {fontScale === 'large' ? '標準文字' : '文字を大きく'}
            </button>
            <button type="button" onClick={showPhoneFallback}>電話相談</button>
          </div>
        </header>

        <div className="safety-strip" aria-label="方針">
          <span>AIは判定しません</span>
          <span>全件ホットラインへ共有</span>
          <span>いつでも修正できます</span>
        </div>

        <div className="progress-wrap" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>

        <main ref={logRef} className="chat-log" aria-live="polite">
          {messages.map(renderMessage)}
          {renderReviewCard()}
          {renderOutputCard()}
        </main>

        <footer className="composer" aria-label="回答入力エリア">
          {renderComposer()}
        </footer>
      </section>
    </div>
  );
}

const styles = `
  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    margin: 0;
  }

  body {
    overflow: hidden;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .hotline-root {
    --bg: #fff7ec;
    --panel: #ffffff;
    --text: #171717;
    --muted: #57534e;
    --border: #d6d3d1;
    --bot: #ffffff;
    --bot-border: #e7e5e4;
    --user: #1d4ed8;
    --primary: #1d4ed8;
    --primary-dark: #153eaa;
    --primary-soft: #e8f0ff;
    --success: #166534;
    --success-bg: #dcfce7;
    --warning: #92400e;
    --warning-bg: #fef3c7;
    --error: #991b1b;
    --error-bg: #fee2e2;
    --focus: #ffbf47;
    --shadow: 0 12px 36px rgba(23, 23, 23, 0.14);
    width: 100vw;
    height: 100dvh;
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 20px;
    line-height: 1.7;
  }

  .hotline-root.large-text {
    font-size: 23px;
  }

  .chat-shell {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto auto 6px 1fr auto;
    background: linear-gradient(180deg, #fffaf4 0%, #fff7ec 100%);
  }

  .chat-header {
    min-height: 76px;
    padding: max(14px, env(safe-area-inset-top)) 22px 14px;
    background: rgba(255, 255, 255, 0.96);
    border-bottom: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .header-avatar,
  .avatar {
    flex: 0 0 auto;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--primary);
    color: #ffffff;
    font-weight: 900;
    letter-spacing: 0.03em;
  }

  .chat-header h1 {
    margin: 0;
    font-size: 1.2em;
    line-height: 1.2;
  }

  .chat-header p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 0.82em;
    line-height: 1.35;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-actions button {
    min-height: 48px;
    border: 2px solid var(--primary);
    border-radius: 999px;
    padding: 8px 14px;
    background: #ffffff;
    color: var(--primary-dark);
    font-size: 0.86em;
    font-weight: 800;
    cursor: pointer;
  }

  .safety-strip {
    padding: 10px 18px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    background: #fffefb;
    border-bottom: 1px solid var(--border);
  }

  .safety-strip span {
    flex: 0 0 auto;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--primary-soft);
    color: var(--primary-dark);
    font-size: 0.82em;
    font-weight: 800;
    white-space: nowrap;
  }

  .progress-wrap {
    background: #e7e5e4;
  }

  .progress-bar {
    height: 100%;
    background: var(--primary);
    transition: width 0.25s ease;
  }

  .chat-log {
    min-height: 0;
    overflow-y: auto;
    padding: 24px clamp(14px, 4vw, 42px);
    scroll-behavior: smooth;
  }

  .message-row {
    display: flex;
    gap: 12px;
    margin: 0 0 18px;
  }

  .bot-row {
    justify-content: flex-start;
  }

  .user-row {
    justify-content: flex-end;
  }

  .bubble {
    max-width: min(860px, 84vw);
    border-radius: 24px;
    padding: 18px 20px;
    box-shadow: 0 6px 22px rgba(23, 23, 23, 0.08);
  }

  .bot-bubble {
    background: var(--bot);
    border: 2px solid var(--bot-border);
    border-top-left-radius: 8px;
  }

  .user-bubble {
    background: var(--user);
    color: #ffffff;
    border-top-right-radius: 8px;
  }

  .bubble p {
    margin: 0;
  }

  .bubble p + p,
  .bubble p + h2,
  .bubble h2 + p {
    margin-top: 8px;
  }

  .bubble h2 {
    margin: 0;
    font-size: 1.34em;
    line-height: 1.35;
  }

  .speaker,
  .small-label {
    color: var(--primary-dark);
    font-size: 0.78em;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .tone-notice {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  .tone-success {
    border-color: #bbf7d0;
    background: var(--success-bg);
    color: var(--success);
  }

  .tone-error {
    border-color: #fecaca;
    background: var(--error-bg);
    color: var(--error);
  }

  .bubble-prefix {
    margin-bottom: 10px !important;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--primary-soft);
    color: var(--primary-dark);
    font-weight: 800;
  }

  .safe-note {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--warning-bg);
    color: var(--warning);
    font-size: 0.9em;
    font-weight: 800;
  }

  .summary-box {
    margin-top: 14px;
    padding: 16px;
    border: 3px solid var(--primary);
    border-radius: 18px;
    background: #f8fbff;
  }

  .summary-box span {
    display: block;
    margin-bottom: 6px;
    color: var(--primary-dark);
    font-size: 0.84em;
    font-weight: 900;
  }

  .summary-box strong {
    display: block;
    font-size: 1.05em;
    line-height: 1.65;
  }

  .original-text {
    margin-top: 12px;
  }

  .original-text summary,
  .output-bubble summary {
    min-height: 48px;
    cursor: pointer;
    font-weight: 900;
    color: var(--primary-dark);
  }

  .next-guidance {
    margin: 14px 0 0;
    padding-left: 1.3em;
  }

  .review-list {
    margin-top: 16px;
    display: grid;
    gap: 10px;
  }

  .review-item,
  .edit-choice {
    width: 100%;
    text-align: left;
    border: 2px solid var(--border);
    border-radius: 18px;
    padding: 14px 16px;
    background: #ffffff;
    color: var(--text);
    cursor: pointer;
  }

  .review-item:hover,
  .edit-choice:hover {
    border-color: var(--primary);
    background: #f8fbff;
  }

  .review-label,
  .review-value,
  .review-source,
  .edit-choice span,
  .edit-choice strong {
    display: block;
  }

  .review-label,
  .edit-choice span {
    color: var(--primary-dark);
    font-size: 0.82em;
    font-weight: 900;
  }

  .review-value,
  .edit-choice strong {
    margin-top: 4px;
    font-size: 1em;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .review-source {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.76em;
    font-weight: 800;
  }

  .output-bubble pre {
    max-height: 320px;
    overflow: auto;
    padding: 14px;
    border-radius: 16px;
    background: #1f2937;
    color: #ffffff;
    font-size: 0.82em;
    white-space: pre-wrap;
  }

  .sheet-grid {
    display: grid;
    grid-template-columns: minmax(130px, 0.55fr) minmax(160px, 1fr);
    gap: 1px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--border);
  }

  .sheet-key,
  .sheet-value {
    padding: 10px 12px;
    background: #ffffff;
    overflow-wrap: anywhere;
    font-size: 0.82em;
  }

  .sheet-key {
    color: var(--primary-dark);
    font-weight: 900;
  }

  .composer {
    padding: 12px clamp(12px, 3vw, 32px) max(12px, env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.98);
    border-top: 2px solid var(--border);
    box-shadow: 0 -10px 28px rgba(23, 23, 23, 0.08);
  }

  .composer-panel {
    width: min(980px, 100%);
    margin: 0 auto;
  }

  .composer-topline {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .composer-title {
    margin: 0 0 10px;
    color: var(--primary-dark);
    font-size: 0.9em;
    font-weight: 900;
  }

  .composer-topline .composer-title {
    margin-bottom: 8px;
  }

  .composer-topline span {
    color: var(--muted);
    font-size: 0.84em;
    font-weight: 900;
  }

  .choice-list,
  .edit-choice-list,
  .action-stack {
    display: grid;
    gap: 10px;
  }

  .choice-list {
    max-height: min(42dvh, 430px);
    overflow-y: auto;
    padding-right: 2px;
  }

  .choice-button {
    width: 100%;
    min-height: 70px;
    border: 3px solid var(--primary);
    border-radius: 20px;
    padding: 14px 18px;
    background: #ffffff;
    color: var(--primary-dark);
    cursor: pointer;
    text-align: left;
    display: grid;
    gap: 3px;
  }

  .choice-main {
    font-size: 1.05em;
    font-weight: 900;
    line-height: 1.3;
  }

  .choice-description {
    color: var(--muted);
    font-size: 0.82em;
    font-weight: 700;
    line-height: 1.35;
  }

  .choice-button:hover,
  .choice-button:active {
    background: var(--primary-soft);
  }

  .text-answer-form {
    display: grid;
    gap: 10px;
  }

  .composer-label {
    color: var(--muted);
    font-size: 0.84em;
    font-weight: 900;
  }

  input,
  textarea {
    width: 100%;
    border: 3px solid var(--border);
    border-radius: 18px;
    padding: 16px;
    background: #ffffff;
    color: var(--text);
    font-size: 1em;
    line-height: 1.6;
  }

  textarea {
    resize: vertical;
    max-height: 30dvh;
  }

  .primary-action,
  .secondary-action {
    min-height: 64px;
    border-radius: 20px;
    padding: 14px 18px;
    cursor: pointer;
    font-weight: 900;
  }

  .primary-action {
    width: 100%;
    border: none;
    background: var(--primary);
    color: #ffffff;
    box-shadow: 0 6px 0 var(--primary-dark);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    font-size: 1.05em;
  }

  .primary-action:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 var(--primary-dark);
  }

  .primary-action strong {
    font-size: 1.6em;
    line-height: 1;
  }

  .secondary-action {
    border: 3px solid var(--primary);
    background: #ffffff;
    color: var(--primary-dark);
    font-size: 0.92em;
  }

  .composer-secondary-row {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .input-error {
    margin-bottom: 10px;
    padding: 12px 14px;
    border: 2px solid #fecaca;
    border-radius: 16px;
    background: var(--error-bg);
    color: var(--error);
    font-weight: 900;
  }

  button:focus-visible,
  input:focus,
  textarea:focus,
  summary:focus-visible {
    outline: 5px solid var(--focus);
    outline-offset: 4px;
  }

  @media (max-width: 720px) {
    .hotline-root {
      font-size: 18px;
    }

    .hotline-root.large-text {
      font-size: 21px;
    }

    .chat-header {
      align-items: stretch;
      flex-direction: column;
      gap: 10px;
      padding-left: 14px;
      padding-right: 14px;
    }

    .header-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .header-actions button {
      width: 100%;
    }

    .chat-log {
      padding: 16px 12px;
    }

    .bubble {
      max-width: calc(100vw - 78px);
      padding: 16px;
    }

    .composer-secondary-row {
      grid-template-columns: 1fr;
    }

    .choice-list {
      max-height: min(46dvh, 430px);
    }

    .sheet-grid {
      grid-template-columns: 1fr;
    }
  }
`;

ReactDOM.createRoot(document.getElementById('root')).render(<HotlineAIAgentV3 />);
