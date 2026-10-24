import {
  type Choice,
  createChoice,
  createDefaultFooter,
  createQuestion,
  createSection,
  type ExamContent,
  type Question,
  type QuestionType,
  type Section,
} from '../types/exam'
import { readingsFor } from './hanToZhuyin'

/** 範例卷頁首。國小低年級的題型，卷名用老師說的「國文」。 */
export const CHINESE_SAMPLE_TITLE = '115學年度第一學期二年級國文第一次定期評量'

export type SampleSubject = 'chinese' | 'math' | 'english'

const SAMPLE_TITLE: Record<SampleSubject, string> = {
  chinese: CHINESE_SAMPLE_TITLE,
  math: '115學年度第一學期三年級數學第一次定期評量',
  english: '115學年度第一學期三年級英文第一次定期評量',
}

export function sampleTitle(subject: SampleSubject = 'chinese'): string {
  return SAMPLE_TITLE[subject]
}

export const SAMPLE_SUBJECTS: { id: SampleSubject; label: string; ready: boolean }[] = [
  { id: 'chinese', label: '國文', ready: true },
  { id: 'math', label: '數學', ready: true },
  { id: 'english', label: '英文', ready: true },
]

/** 方格給學生寫國字；注音留白給學生在國字旁邊寫注音。讀音依詞庫，卷上不印出留白的注音。 */
function withRuby(text: string, face: 'box' | 'blank'): string {
  const readings = readingsFor(text)
  const mark = face === 'box' ? 'yb' : 'yn'
  return [...text]
    .map((ch, i) => {
      const reading = readings[i]
      return reading ? `{{${mark}:${ch}|${reading}}}` : ch
    })
    .join('')
}

function choices(texts: string[]): Choice[] {
  return texts.map((text) => ({ ...createChoice(), text }))
}

function ask(
  type: QuestionType,
  score: number,
  stem: string,
  extra: Partial<Omit<Question, 'id' | 'type' | 'score' | 'stem'>> = {},
): Question {
  return { ...createQuestion(type, score), stem, ...extra }
}

function sec(
  title: string,
  type: QuestionType,
  patch: Partial<Omit<Section, 'id' | 'questions'>>,
  questions: Question[],
): Section {
  return { ...createSection(title, type), ...patch, questions }
}

const CELL = '（　　）'
const MARK = '（　）'

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
      ask('fill_blank', 1, `看注音寫國字：\n${withRuby('花朵美麗', 'box')}`, { answer: '花朵美麗' }),
      ask('fill_blank', 1, `看國字寫注音：\n${withRuby('朋友玩耍', 'blank')}`, {
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

  const synonym = sec(
    '寫出近義詞',
    'fill_blank',
    {
      defaultScore: 2,
      rowSize: 2,
      instruction: '寫出意思相近的詞。',
    },
    [
      ask('fill_blank', 2, `快樂${CELL}`, { answer: '高興' }),
      ask('fill_blank', 2, `美麗${CELL}`, { answer: '漂亮' }),
      ask('fill_blank', 2, `立刻${CELL}`, { answer: '馬上' }),
      ask('fill_blank', 2, `喜歡${CELL}`, { answer: '喜愛' }),
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
    '選擇題',
    'single_choice',
    {
      defaultScore: 3,
      instruction: '選出正確的答案。',
    },
    [
      ask('single_choice', 3, '下列哪一句的用字完全正確？', {
        choices: choices(['小華在公園玩要。', '小華再公園玩耍。', '小華在公園玩耍。', '小華再公園玩要。']),
        choiceLayout: 1,
        answer: 'C',
      }),
      ask('single_choice', 3, '「美麗」的意思最接近哪一個詞？', {
        choices: choices(['難看', '漂亮', '巨大', '安靜']),
        choiceLayout: 4,
        answer: 'B',
      }),
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
      ask('single_choice', 3, '他們什麼時候回家？', {
        choices: choices(['吃完午餐', '下雨的時候', '太陽快下山時', '天還沒亮']),
        choiceLayout: 2,
        answer: 'C',
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
 * 數學範例：國小三年級。填空、比大小、選擇、直式計算、應用題。配分加總 100。
 */
function createMathSample(): ExamContent {
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
      ask('fill_blank', 2, `1 小時 = ${CELL}分鐘`, { answer: '60' }),
      ask('fill_blank', 2, `300 + 50 = ${CELL}`, { answer: '350' }),
      ask('fill_blank', 2, `8 ÷ 2 = ${CELL}`, { answer: '4' }),
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
      ask('fill_blank', 2, `半小時 ${CELL} 25 分鐘`, { answer: '＞' }),
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
      ask('single_choice', 4, '下面哪一個數最大？', {
        choices: choices(['498', '489', '948', '894']),
        choiceLayout: 4,
        answer: 'C',
      }),
      ask('single_choice', 4, '一打是 12 枝。3 打鉛筆一共有幾枝？', {
        choices: choices(['15 枝', '24 枝', '36 枝', '48 枝']),
        choiceLayout: 4,
        answer: 'C',
      }),
      ask('single_choice', 4, '下午 3 時，用 24 時制怎麼寫？', {
        choices: choices(['3 時', '13 時', '15 時', '21 時']),
        choiceLayout: 4,
        answer: 'C',
      }),
      ask('single_choice', 4, '一個正方形有幾條邊？', {
        choices: choices(['3 條', '4 條', '5 條', '6 條']),
        choiceLayout: 4,
        answer: 'B',
      }),
    ],
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
      ask('short_answer', 5, '639 + 285 =', { answerLines: 0, aside: '驗算：', answer: '924' }),
      ask('short_answer', 5, '403 − 158 =', { answerLines: 0, aside: '驗算：', answer: '245' }),
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
      ask('short_answer', 6, '小華有 36 元，買一本 15 元的筆記本，還剩幾元？', {
        answerLines: 3,
        answer: '36 − 15 = 21，還剩 21 元。',
      }),
      ask('short_answer', 6, '公園有 24 人，平均分成 4 組，一組有幾人？', {
        answerLines: 3,
        answer: '24 ÷ 4 = 6，一組 6 人。',
      }),
      ask('short_answer', 6, '一條繩子長 3 公尺，用掉 120 公分，還剩幾公分？', {
        answerLines: 3,
        answer: '3 公尺 = 300 公分，300 − 120 = 180，還剩 180 公分。',
      }),
      ask('short_answer', 6, '電影 2 時 10 分開始，看了 90 分鐘。幾點結束？', {
        answerLines: 3,
        answer: '2 時 10 分再過 90 分鐘是 3 時 40 分。',
      }),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [fill, compare, choice, vertical, word],
    assets: {},
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
      ask('fill_blank', 2, `水 ${CELL}`, { answer: 'water' }),
      ask('fill_blank', 2, `朋友 ${CELL}`, { answer: 'friend' }),
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
      ask('single_choice', 4, 'The dog is ___ the box.\n（狗在箱子裡面）', {
        choices: choices(['on', 'under', 'in', 'to']),
        choiceLayout: 2,
        answer: 'C',
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
      ask('short_answer', 6, '用 "I can..." 造句。', { answerLines: 2, answer: 'I can swim.' }),
    ],
  )

  const reading = sec(
    '閱讀測驗',
    'single_choice',
    {
      defaultScore: 6,
      instruction: '閱讀短文，選出正確的答案。',
      passage:
        "Tom is nine years old.\nHe is a student.\nHe has a brown dog.\nThe dog's name is Lucky.\nOn Sunday, Tom and Lucky\nplay in the park.",
    },
    [
      ask('single_choice', 6, 'How old is Tom?', {
        choices: choices(['seven', 'eight', 'nine', 'ten']),
        choiceLayout: 2,
        answer: 'C',
      }),
      ask('single_choice', 6, 'What does Tom have?', {
        choices: choices(['a cat', 'a dog', 'a bird', 'a fish']),
        choiceLayout: 2,
        answer: 'B',
      }),
      ask('single_choice', 6, 'What color is the dog?', {
        choices: choices(['black', 'white', 'brown', 'yellow']),
        choiceLayout: 2,
        answer: 'C',
      }),
      ask('single_choice', 6, "What is the dog's name?", {
        choices: choices(['Tom', 'Lucky', 'Sunday', 'Park']),
        choiceLayout: 2,
        answer: 'B',
      }),
      ask('single_choice', 6, 'Where do they play on Sunday?', {
        choices: choices(['at school', 'at home', 'in the park', 'in the zoo']),
        choiceLayout: 2,
        answer: 'C',
      }),
    ],
  )

  return {
    numbering: 'perSection',
    sections: [words, choice, grammar, sentence, reading],
    assets: {},
    footer: { ...createDefaultFooter(), continueOn: true, endOn: true },
  }
}

export function createSampleExam(subject: SampleSubject = 'chinese'): ExamContent {
  if (subject === 'math') return createMathSample()
  if (subject === 'english') return createEnglishSample()
  return createChineseSample()
}
