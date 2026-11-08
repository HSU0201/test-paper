import { type Asset, createDefaultFooter, type ExamContent } from '../types/exam'
import { clockSvg, numberLineSvg } from './mathFigures'
import { ask, CELL, choices, MARK, orderRight, pairs, sec, SUB, svgAsset, withFigure } from './sampleKit'
import { createScienceSample, createSocialSample } from './socialScienceSample'

/** 範例卷頁首。國小低年級的題型，卷名用老師說的「國文」。 */
export const CHINESE_SAMPLE_TITLE = '115學年度第一學期二年級國文第一次定期評量'

export type SampleSubject = 'chinese' | 'english' | 'math' | 'social' | 'science'

const SAMPLE_TITLE: Record<SampleSubject, string> = {
  chinese: CHINESE_SAMPLE_TITLE,
  math: '115學年度第一學期三年級數學第一次定期評量',
  english: '115學年度第一學期三年級英文第一次定期評量',
  social: '115學年度第一學期三年級社會第一次定期評量',
  science: '115學年度第一學期三年級自然第一次定期評量',
}

export function sampleTitle(subject: SampleSubject = 'chinese'): string {
  return SAMPLE_TITLE[subject]
}

/** 國、英、數、社、自。每一份都把常用題型各示範一次，配分加總 100 */
export const SAMPLE_SUBJECTS: { id: SampleSubject; label: string; ready: boolean; note: string }[] = [
  { id: 'chinese', label: '國文', ready: true, note: '注音方格、改錯字、成語、連連看、是非、閱讀題組' },
  { id: 'english', label: '英文', ready: true, note: '單字、反義詞連連看、是非、文法、閱讀' },
  { id: 'math', label: '數學', ready: true, note: '分數、時鐘、數線、多選、直式計算、應用題' },
  { id: 'social', label: '社會', ready: true, note: '地圖方位、節日連連看、閱讀題組、雙向細目' },
  { id: 'science', label: '自然', ready: true, note: '植物構造圖、動物連連看、實驗題組、雙向細目' },
]

/**
 * 方格給學生寫國字；注音留白給學生在國字旁邊寫注音。卷上不印出留白的注音。
 * 讀音直接寫在這裡，開頁建立範例卷時不必等注音詞庫載入。
 */
function withRuby(text: string, face: 'box' | 'blank', readings: string[]): string {
  const mark = face === 'box' ? 'yb' : 'yn'
  return [...text]
    .map((ch, i) => {
      const reading = readings[i]
      return reading ? `{{${mark}:${ch}|${reading}}}` : ch
    })
    .join('')
}


/**
 * 國文範例：圖片裡的十四種題型各成一個大題，讓老師打開就能看出卷面長什麼樣子。
 * 配分加總 100。答案只存在題目裡，不會印在試卷上。
 */
function createChineseSample(): ExamContent {
  const ruby = sec(
    '國字注音',
    'fill_blank',
    {
      defaultScore: 1,
      scoreMode: 'blank',
      blankScore: 1,
      instruction: '第 1 題看注音，把國字寫在方格裡。第 2 題看國字，在旁邊的空位寫上注音。',
    },
    [
      ask('fill_blank', 1, `看注音寫國字：\n${withRuby('花朵美麗', 'box', ['ㄏㄨㄚ', 'ㄉㄨㄛˇ', 'ㄇㄟˇ', 'ㄌㄧˋ'])}`, { answer: '花朵美麗' }),
      ask('fill_blank', 1, `看國字寫注音：\n${withRuby('朋友玩耍', 'blank', ['ㄆㄥˊ', 'ㄧㄡˇ', 'ㄨㄢˊ', 'ㄕㄨㄚˇ'])}`, {
        answer: 'ㄆㄥˊ　ㄧㄡˇ　ㄨㄢˊ　ㄕㄨㄚˇ',
      }),
    ],
  )

  const fix = sec(
    '改錯字',
    'fill_blank',
    {
      defaultScore: 2,
      instruction: '圈出錯字，把正確的字寫在（　　）裡。',
    },
    [
      ask('fill_blank', 2, `小明很高興的回到家，心清非常好。${CELL}`, { answer: '情' }),
      ask('fill_blank', 2, `公園裡的花兒都開了，真是太美力了。${CELL}`, { answer: '麗' }),
      ask('fill_blank', 2, `妹妹把圖畫紙拿來，要畫一隻小免。${CELL}`, { answer: '兔' }),
    ],
  )

  const circle = sec(
    '圈選正確',
    'fill_blank',
    {
      defaultScore: 2,
      instruction: '把正確的字圈起來。',
    },
    [
      ask('fill_blank', 2, '小華跑（的、得）很快。', { answer: '得' }),
      ask('fill_blank', 2, '他（在、再）圖書館安靜地看書。', { answer: '在' }),
      ask('fill_blank', 2, '這是一朵（美力、美麗）的花。', { answer: '美麗' }),
    ],
  )

  const words = sec(
    '選詞填空',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      instruction: '從下面的詞語中選出適當的，填入底線。\n愉快　勇敢　仔細　安靜',
    },
    [
      ask('fill_blank', 2, '小明做事很＿＿＿＿，從不馬虎。', { answer: '仔細' }),
      ask('fill_blank', 2, '圖書館裡要保持＿＿＿＿。', { answer: '安靜' }),
      ask('fill_blank', 2, '他＿＿＿＿地幫助同學過馬路。', { answer: '勇敢' }),
      ask('fill_blank', 2, '今天和朋友玩得很＿＿＿＿。', { answer: '愉快' }),
    ],
  )

  const idiom = sec(
    '成語填空',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      instruction: '把成語補充完整。',
    },
    [
      ask('fill_blank', 2, `守株待${CELL}`, { answer: '兔' }),
      ask('fill_blank', 2, `畫蛇添${CELL}`, { answer: '足' }),
      ask('fill_blank', 2, `亡羊補${CELL}`, { answer: '牢' }),
      ask('fill_blank', 2, `一心一${CELL}`, { answer: '意' }),
    ],
  )

  const antonym = sec(
    '寫出反義詞',
    'fill_blank',
    {
      defaultScore: 2,
      rowSize: 2,
      instruction: '寫出反義詞。',
    },
    [
      ask('fill_blank', 2, `大${CELL}`, { answer: '小' }),
      ask('fill_blank', 2, `高${CELL}`, { answer: '矮' }),
      ask('fill_blank', 2, `快${CELL}`, { answer: '慢' }),
      ask('fill_blank', 2, `多${CELL}`, { answer: '少' }),
    ],
  )

  const synonymPairs = pairs([
    ['快樂', '高興'],
    ['美麗', '漂亮'],
    ['立刻', '馬上'],
    ['喜歡', '喜愛'],
    ['', '安靜'],
  ])
  const synonym = sec(
    '近義詞連連看',
    'matching',
    {
      defaultScore: 8,
      instruction: '把意思相近的詞語用線連起來。右邊有一個用不到。',
    },
    [
      ask('matching', 8, '', {
        pairs: synonymPairs,
        matchOrder: orderRight(synonymPairs, ['馬上', '安靜', '高興', '喜愛', '漂亮']),
      }),
    ],
  )

  const punct = sec(
    '填標點符號',
    'fill_blank',
    {
      defaultScore: 1,
      scoreMode: 'blank',
      blankScore: 1,
      instruction: '在（　）裡填上正確的標點符號。',
    },
    [
      ask('fill_blank', 1, `你吃飽了嗎${MARK}`, { answer: '？' }),
      ask('fill_blank', 1, `哇${MARK}好大的雨${MARK}`, { answer: '！、。' }),
      ask('fill_blank', 1, `小明說${MARK}我明天要去公園${MARK}`, { answer: '：、。' }),
    ],
  )

  const extra = sec(
    '刪除多餘字',
    'short_answer',
    {
      defaultScore: 2,
      instruction: '把句子裡多餘的字畫掉。',
    },
    [
      ask('short_answer', 2, '我的的書包很新。', { answerLines: 0, answer: '刪掉第二個「的」' }),
      ask('short_answer', 2, '小明他很高興地回家了。', { answerLines: 0, answer: '刪掉「他」' }),
      ask('short_answer', 2, '春天的景色很美美。', { answerLines: 0, answer: '刪掉一個「美」' }),
    ],
  )

  const order = sec(
    '句子排序',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      instruction: '在（　　）裡填 1、2、3，把句子排成通順的一段話。',
    },
    [
      ask(
        'fill_blank',
        2,
        `${CELL}花兒都開了。\n${CELL}春天來了。\n${CELL}小朋友到公園玩。`,
        { answer: '2、1、3' },
      ),
    ],
  )

  const pattern = sec(
    '照樣寫短語',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      instruction: '照樣子，把短語寫完。',
    },
    [
      ask('fill_blank', 2, '例：大大的眼睛\n＿＿的＿＿', { answer: '例：紅紅的蘋果' }),
      ask('fill_blank', 2, '例：又跑又跳\n又＿＿又＿＿', { answer: '例：又唱又跳' }),
    ],
  )

  const sentence = sec(
    '造句',
    'short_answer',
    {
      defaultScore: 4,
      instruction: '用指定的詞語造句。',
    },
    [
      ask('short_answer', 4, '用「因為……所以……」造句。', {
        answerLines: 2,
        answer: '因為下雨了，所以我們留在教室。',
      }),
      ask('short_answer', 4, '用「快樂」造句。', {
        answerLines: 2,
        answer: '我和同學一起遊戲，感到十分快樂。',
      }),
    ],
  )

  const choice = sec(
    '是非題',
    'true_false',
    {
      defaultScore: 2,
      instruction: '對的打○，錯的打×。',
    },
    [
      ask('true_false', 2, '「小華在公園玩耍。」這一句的用字完全正確。', { answer: '○' }),
      ask('true_false', 2, '問句的最後要加上句號「。」。', { answer: '×' }),
      ask('true_false', 2, '「美麗」和「漂亮」的意思相近。', { answer: '○' }),
    ],
  )

  const reading = sec(
    '閱讀測驗',
    'single_choice',
    {
      defaultScore: 3,
      instruction: '閱讀短文，回答下面的問題。',
      passage:
        '星期日早上，小明和妹妹一起去公園。公園裡的花開了，蝴蝶在花叢中飛來飛去。妹妹追著蝴蝶跑，小明坐在椅子上看書。太陽快下山的時候，他們才牽著手回家。',
    },
    [
      ask('single_choice', 3, '小明和妹妹星期日去了哪裡？', {
        choices: choices(['學校', '公園', '圖書館', '海邊']),
        choiceLayout: 4,
        answer: 'B',
      }),
      ask('single_choice', 3, '妹妹在公園裡做什麼？', {
        choices: choices(['坐著看書', '追蝴蝶', '畫畫', '睡覺']),
        choiceLayout: 4,
        answer: 'B',
      }),
      ask('short_answer', 3, `根據短文回答：\n${SUB}他們什麼時候回家？\n${SUB}如果你是小明，你會在公園做什麼？`, {
        answerLines: 3,
        answer: '①太陽快下山的時候。②（言之成理即可）',
      }),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [ruby, fix, circle, words, idiom, antonym, synonym, punct, extra, order, pattern, sentence, choice, reading],
    assets: {},
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

/**
 * 數學範例：國小三年級。填空（含分數）、比大小、是非、選擇（含多選、看時鐘）、
 * 連連看、看圖作答（數線、畫時鐘）、直式計算、應用題（含子題號）。配分加總 100。
 */
function createMathSample(): ExamContent {
  const assets: Record<string, Asset> = {}
  const f = (num: number, den: number) => `{{f:${num}|${den}}}`

  const fill = sec(
    '填空',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      rowSize: 2,
      instruction: '把答案填在（　　）裡。',
    },
    [
      ask('fill_blank', 2, `48 + 27 = ${CELL}`, { answer: '75' }),
      ask('fill_blank', 2, `90 − 36 = ${CELL}`, { answer: '54' }),
      ask('fill_blank', 2, `7 × 8 = ${CELL}`, { answer: '56' }),
      ask('fill_blank', 2, `36 ÷ 6 = ${CELL}`, { answer: '6' }),
      ask('fill_blank', 2, `1 公尺 = ${CELL}公分`, { answer: '100' }),
      ask('fill_blank', 2, `${f(1, 5)} ＋ ${f(2, 5)} = ${CELL}`, { answer: '3/5' }),
    ],
  )

  const compare = sec(
    '比大小',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      rowSize: 2,
      instruction: '在（　　）裡填 ＞、＜ 或 ＝。',
    },
    [
      ask('fill_blank', 2, `356 ${CELL} 365`, { answer: '＜' }),
      ask('fill_blank', 2, `8 × 7 ${CELL} 54`, { answer: '＞' }),
      ask('fill_blank', 2, `2 公尺 ${CELL} 180 公分`, { answer: '＞' }),
      ask('fill_blank', 2, `${f(3, 8)} ${CELL} ${f(5, 8)}`, { answer: '＜' }),
    ],
  )

  const trueFalse = sec(
    '是非題',
    'true_false',
    {
      defaultScore: 2,
      instruction: '對的打○，錯的打×。',
    },
    [
      ask('true_false', 2, '三角形有 3 個角。', { answer: '○' }),
      ask('true_false', 2, '1 公斤 = 100 公克。', { answer: '×' }),
      ask('true_false', 2, '任何數乘以 0，答案都是 0。', { answer: '○' }),
      ask('true_false', 2, `${f(1, 2)} 比 ${f(1, 3)} 小。`, { answer: '×' }),
    ],
  )

  const clockAsk = withFigure(
    ask('single_choice', 4, '鐘面上是幾時幾分？', {
      choices: choices(['3 時 15 分', '3 時 45 分', '9 時 15 分', '4 時 15 分']),
      choiceLayout: 2,
      answer: 'A',
    }),
    assets,
    svgAsset(clockSvg({ hour: 3, minute: 15, hands: true, numbers: true })),
    'below',
    0.5,
  )
  const choice = sec(
    '選擇題',
    'single_choice',
    {
      defaultScore: 4,
      instruction: '選出正確的答案。第 3 題可以選不只一個。',
    },
    [
      ask('single_choice', 4, '一打是 12 枝。3 打鉛筆一共有幾枝？', {
        choices: choices(['15 枝', '24 枝', '36 枝', '48 枝']),
        choiceLayout: 4,
        answer: 'C',
      }),
      clockAsk,
      ask('multi_choice', 4, '下面哪些是雙數？（多選）', {
        choices: choices(['12', '15', '28', '33']),
        choiceLayout: 4,
        answer: 'A、C',
      }),
    ],
  )

  const calcPairs = pairs([
    ['6 × 4', '24'],
    ['35 ÷ 5', '7'],
    ['18 + 9', '27'],
    ['50 − 12', '38'],
    ['', '42'],
  ])
  const matching = sec(
    '連連看',
    'matching',
    {
      defaultScore: 8,
      instruction: '把算式和答案用線連起來。右邊有一個用不到。',
    },
    [ask('matching', 8, '', { pairs: calcPairs, matchOrder: orderRight(calcPairs, ['27', '42', '24', '38', '7']) })],
  )

  const lineAsk = withFigure(
    ask('fill_blank', 4, `看數線，把空格代表的數寫出來。\n左邊的空格是 ${CELL}，右邊的空格是 ${CELL}`, { answer: '30、70' }),
    assets,
    svgAsset(numberLineSvg({ start: 0, end: 100, step: 10, labelEvery: 1, blanks: [30, 70] })!),
    'below',
    0.9,
  )
  const drawAsk = withFigure(
    ask('short_answer', 4, '在鐘面上畫出 4 時 30 分的長針和短針。', { answerLines: 0, answer: '短針在 4 和 5 中間，長針指著 6。' }),
    assets,
    svgAsset(clockSvg({ hour: 0, minute: 0, hands: false, numbers: true })),
    'below',
    0.5,
  )
  const picture = sec(
    '看圖作答',
    'fill_blank',
    {
      defaultScore: 4,
      instruction: '看圖回答問題。',
    },
    [lineAsk, drawAsk],
  )

  const vertical = sec(
    '直式計算',
    'short_answer',
    {
      defaultScore: 5,
      layout: 'rows',
      rowLines: 5,
      numberStyle: 'paren',
      instruction: '用直式計算。右邊的空位可以驗算。',
    },
    [
      ask('short_answer', 5, '256 + 178 =', { answerLines: 0, aside: '驗算：', answer: '434' }),
      ask('short_answer', 5, '500 − 267 =', { answerLines: 0, aside: '驗算：', answer: '233' }),
      ask('short_answer', 5, '46 × 7 =', { answerLines: 0, aside: '驗算：', answer: '322' }),
      ask('short_answer', 5, '84 ÷ 4 =', { answerLines: 0, aside: '驗算：', answer: '21' }),
    ],
  )

  const word = sec(
    '應用題',
    'short_answer',
    {
      defaultScore: 6,
      instruction: '寫出算式，並寫上答案和單位。',
    },
    [
      ask('short_answer', 6, '一盒有 8 顆糖果，5 盒一共有幾顆？', {
        answerLines: 3,
        answer: '8 × 5 = 40，一共 40 顆。',
      }),
      ask('short_answer', 6, '公園有 24 人，平均分成 4 組，一組有幾人？', {
        answerLines: 3,
        answer: '24 ÷ 4 = 6，一組 6 人。',
      }),
      ask('short_answer', 6, '一條繩子長 3 公尺，用掉 120 公分，還剩幾公分？', {
        answerLines: 3,
        answer: '3 公尺 = 300 公分，300 − 120 = 180，還剩 180 公分。',
      }),
      ask('short_answer', 6, `小明有 50 元。\n${SUB}買一枝 12 元的筆，還剩幾元？\n${SUB}剩下的錢夠不夠再買 3 枝同樣的筆？`, {
        answerLines: 4,
        answer: '①50 − 12 = 38，還剩 38 元。②12 × 3 = 36，36 ＜ 38，夠。',
      }),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [fill, compare, trueFalse, choice, matching, picture, vertical, word],
    assets,
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

/**
 * 英文範例：國小三年級。單字、選擇、文法填空、造句、閱讀。配分加總 100。
 */
function createEnglishSample(): ExamContent {
  const words = sec(
    '看中文寫英文',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      rowSize: 2,
      instruction: '看中文，把英文單字寫在（　　）裡。',
    },
    [
      ask('fill_blank', 2, `蘋果 ${CELL}`, { answer: 'apple' }),
      ask('fill_blank', 2, `書 ${CELL}`, { answer: 'book' }),
      ask('fill_blank', 2, `貓 ${CELL}`, { answer: 'cat' }),
      ask('fill_blank', 2, `狗 ${CELL}`, { answer: 'dog' }),
      ask('fill_blank', 2, `紅色 ${CELL}`, { answer: 'red' }),
      ask('fill_blank', 2, `老師 ${CELL}`, { answer: 'teacher' }),
      ask('fill_blank', 2, `學校 ${CELL}`, { answer: 'school' }),
      ask('fill_blank', 2, `快樂 ${CELL}`, { answer: 'happy' }),
    ],
  )

  const oppositePairs = pairs([
    ['big', 'small'],
    ['hot', 'cold'],
    ['happy', 'sad'],
    ['up', 'down'],
    ['', 'fast'],
  ])
  const opposite = sec(
    '反義詞連連看',
    'matching',
    {
      defaultScore: 8,
      instruction: 'Match the opposites. 把意思相反的字連起來。',
    },
    [
      ask('matching', 8, '', {
        pairs: oppositePairs,
        matchOrder: orderRight(oppositePairs, ['cold', 'down', 'fast', 'small', 'sad']),
      }),
    ],
  )

  const trueFalse = sec(
    '是非題',
    'true_false',
    {
      defaultScore: 2,
      instruction: 'Read and check. 對的打○，錯的打×。',
    },
    [
      ask('true_false', 2, 'A cat can fly.', { answer: '×' }),
      ask('true_false', 2, 'There are seven days in a week.', { answer: '○' }),
      ask('true_false', 2, 'We eat breakfast in the morning.', { answer: '○' }),
      ask('true_false', 2, 'Snow is hot.', { answer: '×' }),
    ],
  )

  const choice = sec(
    '選擇題',
    'single_choice',
    {
      defaultScore: 4,
      instruction: '選出正確的答案。',
    },
    [
      ask('single_choice', 4, 'What color is an apple?', {
        choices: choices(['blue', 'red', 'black', 'white']),
        choiceLayout: 2,
        answer: 'B',
      }),
      ask('single_choice', 4, '有人問 "How are you?" 怎麼回答？', {
        choices: choices(["I'm fine.", "I'm eight.", "I'm Tom.", 'Good night.']),
        choiceLayout: 2,
        answer: 'A',
      }),
      ask('single_choice', 4, 'She ___ my sister.', {
        choices: choices(['am', 'is', 'are', 'be']),
        choiceLayout: 2,
        answer: 'B',
      }),
      ask('single_choice', 4, 'I have two ___.', {
        choices: choices(['book', 'books', 'a book', 'the book']),
        choiceLayout: 2,
        answer: 'B',
      }),

    ],
  )

  const grammar = sec(
    '文法填空',
    'fill_blank',
    {
      defaultScore: 2,
      scoreMode: 'blank',
      blankScore: 2,
      instruction: '從下面選出適當的字，填入底線。每個字用一次。\nam　is　are\nan　in　sing',
    },
    [
      ask('fill_blank', 2, 'I ＿＿ a student.', { answer: 'am' }),
      ask('fill_blank', 2, 'They ＿＿ my friends.', { answer: 'are' }),
      ask('fill_blank', 2, 'This is ＿＿ apple.', { answer: 'an' }),
      ask('fill_blank', 2, 'I can ＿＿ a song.', { answer: 'sing' }),
      ask('fill_blank', 2, 'She is ＿＿ the classroom.', { answer: 'in' }),
      ask('fill_blank', 2, 'My name ＿＿ Amy.', { answer: 'is' }),
    ],
  )

  const sentence = sec(
    '照樣造句',
    'short_answer',
    {
      defaultScore: 6,
      instruction: '用指定的開頭造一個英文句子。',
    },
    [
      ask('short_answer', 6, '用 "I like..." 造句。', { answerLines: 2, answer: 'I like apples.' }),
      ask('short_answer', 6, '用 "This is..." 造句。', { answerLines: 2, answer: 'This is my book.' }),

    ],
  )

  const reading = sec(
    '閱讀測驗',
    'single_choice',
    {
      defaultScore: 7,
      instruction: '閱讀短文，選出正確的答案。',
      passage:
        "Tom is nine years old.\nHe is a student.\nHe has a brown dog.\nThe dog's name is Lucky.\nOn Sunday, Tom and Lucky\nplay in the park.",
    },
    [
      ask('single_choice', 7, 'How old is Tom?', {
        choices: choices(['seven', 'eight', 'nine', 'ten']),
        choiceLayout: 2,
        answer: 'C',
      }),
      ask('single_choice', 7, 'What does Tom have?', {
        choices: choices(['a cat', 'a dog', 'a bird', 'a fish']),
        choiceLayout: 2,
        answer: 'B',
      }),
      ask('single_choice', 7, 'What color is the dog?', {
        choices: choices(['black', 'white', 'brown', 'yellow']),
        choiceLayout: 2,
        answer: 'C',
      }),

      ask('single_choice', 7, 'Where do they play on Sunday?', {
        choices: choices(['at school', 'at home', 'in the park', 'in the zoo']),
        choiceLayout: 2,
        answer: 'C',
      }),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [words, opposite, choice, trueFalse, grammar, sentence, reading],
    assets: {},
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

export function createSampleExam(subject: SampleSubject = 'chinese'): ExamContent {
  if (subject === 'math') return createMathSample()
  if (subject === 'english') return createEnglishSample()
  if (subject === 'social') return createSocialSample()
  if (subject === 'science') return createScienceSample()
  return createChineseSample()
}
