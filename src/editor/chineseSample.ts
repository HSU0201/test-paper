import { readingsFor } from './hanToZhuyin'
import {
  createChoice,
  createDefaultFooter,
  createQuestion,
  createSection,
  type Choice,
  type ExamContent,
  type Question,
  type QuestionType,
  type Section,
} from '../types/exam'

/** 範例卷頁首。國小低年級的題型，卷名用老師說的「國文」。 */
export const CHINESE_SAMPLE_TITLE = '115學年度第一學期二年級國文第一次定期評量'

export type SampleSubject = 'chinese' | 'math' | 'science'

export const SAMPLE_SUBJECTS: { id: SampleSubject; label: string; ready: boolean }[] = [
  { id: 'chinese', label: '國文', ready: true },
  { id: 'math', label: '數學', ready: false },
  { id: 'science', label: '自然', ready: false },
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

export function createSampleExam(subject: SampleSubject = 'chinese'): ExamContent {
  if (subject === 'chinese') return createChineseSample()
  return { numbering: 'perSection', sections: [], assets: {}, footer: createDefaultFooter() }
}
