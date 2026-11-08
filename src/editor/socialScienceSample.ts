/**
 * 社會、自然範例：國小三年級。每份把常用題型各示範一次，並在每一題標好
 * 單元、能力、難易度，打開「工具 → 答案表與雙向細目表」就看得到統計。配分加總 100。
 */
import { type Asset, createDefaultFooter, type ExamContent } from '../types/exam'
import { ask, CELL, choices, orderRight, pairs, sec, SUB, svgAsset, tag, withFigure } from './sampleKit'

const FONT = '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif'

/** 社區地圖：學校在中間，四周各有一個地點，右上角是方位圖 */
function townMap() {
  const w = 420
  const h = 300
  const place = (x: number, y: number, label: string, fill: string) =>
    `<rect x="${x - 46}" y="${y - 20}" width="92" height="40" rx="6" fill="${fill}" stroke="#111" stroke-width="2"/>` +
    `<text x="${x}" y="${y}" font-size="22" font-family='${FONT}' text-anchor="middle" dominant-baseline="central">${label}</text>`
  const road = `<rect x="0" y="${h / 2 - 12}" width="${w}" height="24" fill="#e5e7eb"/><rect x="${w / 2 - 12}" y="0" width="24" height="${h}" fill="#e5e7eb"/>`
  const rose =
    `<g transform="translate(${w - 40} 44)"><circle r="26" fill="#fff" stroke="#111" stroke-width="1.5"/>` +
    `<path d="M0 -22 L6 0 L0 22 L-6 0 Z" fill="#111"/>` +
    `<text y="-30" font-size="14" font-family='${FONT}' text-anchor="middle">北</text></g>`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="2"/>${road}` +
    place(w / 2, h / 2, '學校', '#fff7d6') +
    place(w / 2, 40, '公園', '#fff') +
    place(w - 70, h / 2, '郵局', '#fff') +
    place(w / 2, h - 40, '醫院', '#fff') +
    place(70, h / 2, '圖書館', '#fff') +
    rose +
    `</svg>`
  return { svg, width: w, height: h }
}

/** 植物的構造：花、葉、莖、根，旁邊標上 ①②③④ */
function plantDiagram() {
  const w = 300
  const h = 320
  const label = (x: number, y: number, n: string, tx: number, ty: number) =>
    `<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="#111" stroke-width="1.5"/>` +
    `<text x="${tx + (tx > x ? 6 : -6)}" y="${ty}" font-size="22" font-family='${FONT}' text-anchor="${tx > x ? 'start' : 'end'}" dominant-baseline="central">${n}</text>`
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="150" cy="44" rx="14" ry="26" transform="rotate(${a} 150 70)" fill="#fde68a" stroke="#111" stroke-width="1.5"/>`)
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#fff"/>` +
    `<rect x="40" y="226" width="220" height="4" fill="#a16207"/>` +
    `<path d="M150 230 C150 260 130 280 110 300 M150 230 C152 262 170 282 196 300 M150 240 C140 260 150 290 150 310" stroke="#111" stroke-width="2" fill="none"/>` +
    `<path d="M150 230 L150 92" stroke="#15803d" stroke-width="6"/>` +
    `<path d="M150 170 C180 140 220 150 230 160 C210 180 170 182 150 170 Z" fill="#86efac" stroke="#111" stroke-width="1.5"/>` +
    `<path d="M150 190 C120 160 80 168 70 178 C92 200 132 200 150 190 Z" fill="#86efac" stroke="#111" stroke-width="1.5"/>` +
    petals +
    `<circle cx="150" cy="70" r="12" fill="#f59e0b" stroke="#111" stroke-width="1.5"/>` +
    label(168, 60, '①', 240, 40) +
    label(215, 158, '②', 262, 120) +
    label(150, 130, '③', 70, 110) +
    label(130, 286, '④', 60, 286) +
    `</svg>`
  return { svg, width: w, height: h }
}

export function createSocialSample(): ExamContent {
  const assets: Record<string, Asset> = {}
  const U1 = '家鄉的地理'
  const U2 = '社區與公共設施'
  const U3 = '節日與習俗'

  const trueFalse = sec(
    '是非題',
    'true_false',
    { defaultScore: 2, instruction: '對的打○，錯的打×。' },
    [
      tag(ask('true_false', 2, '地圖上通常上方代表北方。', { answer: '○' }), U1, '記憶', 'easy'),
      tag(ask('true_false', 2, '公園、圖書館都是公共設施，大家都可以使用。', { answer: '○' }), U2, '理解', 'easy'),
      tag(ask('true_false', 2, '看到消防車鳴笛經過，應該跟過去看熱鬧。', { answer: '×' }), U2, '應用', 'easy'),
      tag(ask('true_false', 2, '端午節的習俗是賞月、吃月餅。', { answer: '×' }), U3, '記憶', 'easy'),
      tag(ask('true_false', 2, '比例尺可以幫我們知道地圖上的距離是實際的多少。', { answer: '○' }), U1, '理解', 'medium'),
    ],
  )

  const choice = sec(
    '選擇題',
    'single_choice',
    { defaultScore: 3, instruction: '選出正確的答案。第 6 題可以選不只一個。' },
    [
      tag(
        ask('single_choice', 3, '想知道學校附近有哪些商店，最適合看哪一種地圖？', {
          choices: choices(['世界地圖', '臺灣地圖', '社區地圖', '地形圖']),
          answer: 'C',
        }),
        U1,
        '應用',
        'medium',
      ),
      tag(
        ask('single_choice', 3, '寄信、領包裹要到哪裡？', {
          choices: choices(['郵局', '警察局', '消防局', '衛生所']),
          answer: 'A',
        }),
        U2,
        '記憶',
        'easy',
      ),
      tag(
        ask('single_choice', 3, '社區裡的路燈壞了，最適合怎麼做？', {
          choices: choices(['自己爬上去修', '通知里長或打電話給公所', '不用理它', '在路燈上貼紙條']),
          answer: 'B',
        }),
        U2,
        '應用',
        'medium',
      ),
      tag(
        ask('single_choice', 3, '下列哪一個節日是農曆正月十五日？', {
          choices: choices(['春節', '元宵節', '端午節', '中秋節']),
          answer: 'B',
        }),
        U3,
        '記憶',
        'medium',
      ),
      tag(
        ask('single_choice', 3, '在圖書館裡，下列哪一個行為是對的？', {
          choices: choices(['大聲聊天', '把書摺角做記號', '看完把書放回原位', '在書上畫重點']),
          answer: 'C',
        }),
        U2,
        '理解',
        'easy',
      ),
      tag(
        ask('multi_choice', 3, '下列哪些是公共設施？（多選）', {
          choices: choices(['公園', '自己家的客廳', '圖書館', '活動中心']),
          answer: 'A、C、D',
        }),
        U2,
        '理解',
        'medium',
      ),
    ],
  )

  const fill = sec(
    '填充題',
    'fill_blank',
    { defaultScore: 2, scoreMode: 'blank', blankScore: 2, instruction: '把正確的答案寫在（　　）裡。' },
    [
      tag(ask('fill_blank', 2, `地圖上的四個基本方位是東、西、南、${CELL}。`, { answer: '北' }), U1, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `生病要看醫生，可以到醫院或${CELL}。`, { answer: '診所／衛生所' }), U2, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `發生火災要打電話${CELL}。`, { answer: '119' }), U2, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `遇到壞人或交通事故要打電話${CELL}。`, { answer: '110' }), U2, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `清明節的習俗是${CELL}。`, { answer: '掃墓' }), U3, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `中秋節的晚上，大家一起${CELL}、吃月餅。`, { answer: '賞月' }), U3, '記憶', 'easy'),
    ],
  )

  const festivalPairs = pairs([
    ['春節', '貼春聯'],
    ['元宵節', '提燈籠'],
    ['端午節', '划龍舟'],
    ['中秋節', '賞月'],
  ])
  const matching = sec(
    '連連看',
    'matching',
    { defaultScore: 12, instruction: '把節日和它的習俗用線連起來。' },
    [
      tag(
        ask('matching', 12, '', {
          pairs: festivalPairs,
          matchOrder: orderRight(festivalPairs, ['划龍舟', '賞月', '貼春聯', '提燈籠']),
        }),
        U3,
        '記憶',
        'easy',
      ),
    ],
  )

  const mapAsk = withFigure(
    ask(
      'fill_blank',
      12,
      `看社區地圖回答：\n${SUB}公園在學校的${CELL}方。\n${SUB}郵局在學校的${CELL}方。\n${SUB}醫院在學校的${CELL}方。\n${SUB}從圖書館走到郵局，要往${CELL}走。`,
      { answer: '北、東、南、東' },
    ),
    assets,
    svgAsset(townMap()),
    'below',
    0.8,
  )
  const map = sec(
    '看地圖找方位',
    'fill_blank',
    { defaultScore: 3, scoreMode: 'blank', blankScore: 3, instruction: '看地圖，把方位寫在（　　）裡。' },
    [tag(mapAsk, U1, '應用', 'medium')],
  )

  const reading = sec(
    '閱讀題組',
    'single_choice',
    {
      defaultScore: 5,
      instruction: '閱讀短文，回答下面的問題。',
      passage:
        '小美住的社區有一座活動中心。平日的早上，爺爺奶奶在這裡跳舞、下棋；放學後，小朋友在這裡寫功課、借書。週末時，里長會在活動中心舉辦淨街活動，大家一起把社區打掃乾淨。',
    },
    [
      tag(
        ask('single_choice', 5, '放學後，小朋友會在活動中心做什麼？', {
          choices: choices(['跳舞', '下棋', '寫功課、借書', '淨街']),
          answer: 'C',
        }),
        U2,
        '理解',
        'easy',
      ),
      tag(
        ask('single_choice', 5, '舉辦淨街活動的是誰？', {
          choices: choices(['小美', '里長', '爺爺', '老師']),
          answer: 'B',
        }),
        U2,
        '理解',
        'easy',
      ),
      tag(
        ask('short_answer', 6, `根據短文回答：\n${SUB}活動中心是給誰使用的？\n${SUB}你可以怎麼幫忙讓社區更乾淨？`, {
          answerLines: 3,
          answer: '①社區裡的每一個人。②（言之成理即可，例如不亂丟垃圾、參加淨街）',
        }),
        U2,
        '分析',
        'hard',
      ),
    ],
  )

  const essay = sec(
    '問答題',
    'short_answer',
    { defaultScore: 10, instruction: '把答案寫在線上。' },
    [
      tag(
        ask('short_answer', 10, '寫出你家附近的一個公共設施，並說說它對大家有什麼幫助。', {
          answerLines: 3,
          answer: '（言之成理即可）例：公園，讓大家可以運動、休息。',
        }),
        U2,
        '應用',
        'medium',
      ),
      tag(
        ask('short_answer', 10, '過年時你家會做哪些事？寫出兩件。', {
          answerLines: 3,
          answer: '（言之成理即可）例：貼春聯、吃年夜飯、領紅包。',
        }),
        U3,
        '應用',
        'medium',
      ),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [trueFalse, choice, fill, matching, map, reading, essay],
    assets,
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

export function createScienceSample(): ExamContent {
  const assets: Record<string, Asset> = {}
  const U1 = '植物的身體'
  const U2 = '動物大觀園'
  const U3 = '水的變化'
  const U4 = '磁鐵'

  const trueFalse = sec(
    '是非題',
    'true_false',
    { defaultScore: 2, instruction: '對的打○，錯的打×。' },
    [
      tag(ask('true_false', 2, '植物的根可以吸收水分。', { answer: '○' }), U1, '記憶', 'easy'),
      tag(ask('true_false', 2, '所有的鳥都會飛。', { answer: '×' }), U2, '理解', 'medium'),
      tag(ask('true_false', 2, '水結冰以後，就不是水了。', { answer: '×' }), U3, '理解', 'medium'),
      tag(ask('true_false', 2, '磁鐵可以吸住鐵做的東西。', { answer: '○' }), U4, '記憶', 'easy'),
      tag(ask('true_false', 2, '兩個磁鐵的 N 極靠近時，會互相吸引。', { answer: '×' }), U4, '理解', 'medium'),
    ],
  )

  const choice = sec(
    '選擇題',
    'single_choice',
    { defaultScore: 3, instruction: '選出正確的答案。第 6 題可以選不只一個。' },
    [
      tag(
        ask('single_choice', 3, '植物的葉子主要的功能是什麼？', {
          choices: choices(['吸收水分', '製造養分', '開花結果', '固定植物']),
          answer: 'B',
        }),
        U1,
        '理解',
        'medium',
      ),
      tag(
        ask('single_choice', 3, '下列哪一種動物是用鰓呼吸？', {
          choices: choices(['狗', '魚', '鳥', '青蛙的成蛙']),
          answer: 'B',
        }),
        U2,
        '記憶',
        'easy',
      ),
      tag(
        ask('single_choice', 3, '把冰塊放在室溫下，冰塊會怎麼樣？', {
          choices: choices(['變大', '慢慢融化成水', '變成石頭', '不會改變']),
          answer: 'B',
        }),
        U3,
        '理解',
        'easy',
      ),
      tag(
        ask('single_choice', 3, '水煮開時冒出的白煙，其實是什麼？', {
          choices: choices(['灰塵', '空氣', '小水滴', '煙霧']),
          answer: 'C',
        }),
        U3,
        '分析',
        'hard',
      ),
      tag(
        ask('single_choice', 3, '磁鐵哪個地方的磁力最強？', {
          choices: choices(['中間', '兩端', '每個地方都一樣', '沒有磁力']),
          answer: 'B',
        }),
        U4,
        '記憶',
        'medium',
      ),
      tag(
        ask('multi_choice', 3, '下列哪些東西會被磁鐵吸住？（多選）', {
          choices: choices(['迴紋針', '鐵釘', '橡皮擦', '塑膠尺']),
          answer: 'A、B',
        }),
        U4,
        '應用',
        'medium',
      ),
    ],
  )

  const fill = sec(
    '填充題',
    'fill_blank',
    { defaultScore: 2, scoreMode: 'blank', blankScore: 2, instruction: '把正確的答案寫在（　　）裡。' },
    [
      tag(ask('fill_blank', 2, `冰是水的${CELL}態。`, { answer: '固' }), U3, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `水蒸氣是水的${CELL}態。`, { answer: '氣' }), U3, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `磁鐵有 N 極和${CELL}極。`, { answer: 'S' }), U4, '記憶', 'easy'),
      tag(ask('fill_blank', 2, `同極互相${CELL}，異極互相吸引。`, { answer: '排斥' }), U4, '理解', 'medium'),
      tag(ask('fill_blank', 2, `昆蟲的身體分成頭、胸、${CELL}三部分。`, { answer: '腹' }), U2, '記憶', 'medium'),
      tag(ask('fill_blank', 2, `昆蟲有${CELL}隻腳。`, { answer: '6' }), U2, '記憶', 'easy'),
    ],
  )

  const animalPairs = pairs([
    ['鳥', '羽毛'],
    ['魚', '鱗片'],
    ['狗', '毛'],
    ['烏龜', '硬殼'],
  ])
  const matching = sec(
    '連連看',
    'matching',
    { defaultScore: 12, instruction: '動物的身體外面有什麼？把動物和牠的身體覆蓋物連起來。' },
    [
      tag(
        ask('matching', 12, '', {
          pairs: animalPairs,
          matchOrder: orderRight(animalPairs, ['鱗片', '硬殼', '羽毛', '毛']),
        }),
        U2,
        '理解',
        'easy',
      ),
    ],
  )

  const plantAsk = withFigure(
    ask(
      'fill_blank',
      12,
      `看圖寫出植物各部位的名稱：\n${SUB}① 是${CELL}\n${SUB}② 是${CELL}\n${SUB}③ 是${CELL}\n${SUB}④ 是${CELL}`,
      { answer: '花、葉、莖、根', subStyle: 'paren' },
    ),
    assets,
    svgAsset(plantDiagram()),
    'below',
    0.55,
  )
  const plant = sec(
    '看圖作答',
    'fill_blank',
    { defaultScore: 3, scoreMode: 'blank', blankScore: 3, instruction: '看圖，把名稱寫在（　　）裡。' },
    [tag(plantAsk, U1, '記憶', 'easy')],
  )

  const lab = sec(
    '實驗題組',
    'single_choice',
    {
      defaultScore: 5,
      instruction: '閱讀實驗紀錄，回答下面的問題。',
      passage:
        '小安把兩塊一樣大的冰塊，一塊放在陽光下，一塊放在教室的陰涼處。每隔 5 分鐘觀察一次，結果陽光下的冰塊先融化完。',
    },
    [
      tag(
        ask('single_choice', 5, '這個實驗想知道什麼？', {
          choices: choices(['冰塊有多重', '溫度對冰塊融化快慢的影響', '冰塊是什麼顏色', '水會不會結冰']),
          answer: 'B',
        }),
        U3,
        '分析',
        'medium',
      ),
      tag(
        ask('single_choice', 5, '為什麼兩塊冰塊要一樣大？', {
          choices: choices(['比較好看', '讓比較公平', '冰塊只有這麼大', '沒有原因']),
          answer: 'B',
        }),
        U3,
        '分析',
        'hard',
      ),
      tag(
        ask('short_answer', 6, `根據實驗回答：\n${SUB}哪一塊冰塊先融化？\n${SUB}從這個實驗可以知道什麼？`, {
          answerLines: 3,
          answer: '①陽光下的冰塊。②溫度越高，冰融化得越快。',
        }),
        U3,
        '分析',
        'hard',
      ),
    ],
  )

  const essay = sec(
    '問答題',
    'short_answer',
    { defaultScore: 10, instruction: '把答案寫在線上。' },
    [
      tag(
        ask('short_answer', 10, '如果一盆植物很久沒有澆水，會發生什麼事？為什麼？', {
          answerLines: 3,
          answer: '會枯萎。因為根吸收不到水分，植物沒辦法生長。',
        }),
        U1,
        '應用',
        'medium',
      ),
      tag(
        ask('short_answer', 10, '生活中有哪些地方用到磁鐵？寫出兩個例子。', {
          answerLines: 3,
          answer: '（言之成理即可）例：冰箱門、鉛筆盒、白板上的磁鐵。',
        }),
        U4,
        '應用',
        'medium',
      ),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [trueFalse, choice, fill, matching, plant, lab, essay],
    assets,
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}
