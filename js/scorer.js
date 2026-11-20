/**
 * 模組名稱：scorer.js
 * 模組職責：實作國考評分引擎，精準判定單選、考選部複數給分（如 A/D、A/B/C）與「一律給分」規則，並計算總分與各科正確率。
 */

/**
 * 判定單一題目之使用者作答是否得分。
 *
 * @param {Object} question - 標準化題目物件（包含 answers 正解陣列）。
 * @param {string|null|undefined} userAnswer - 使用者選擇的選項代碼（"A"~"D" 或空值）。
 * @returns {{ isCorrect: boolean, isGiveAll: boolean, isAnswered: boolean }} 判定結果物件。
 */
export function evaluateSingleQuestion(question, userAnswer) {
  // 取得正規化正解陣列
  const validAnswers = Array.isArray(question.answers) ? question.answers : [];
  // 檢查是否為考選部公告「一律給分」題
  const isGiveAll = validAnswers.includes("ALL");
  // 檢查使用者是否已作答
  const isAnswered = Boolean(userAnswer);

  // 一律給分題無論作答與否皆判定為得分；一般與複數正解題需比對是否命中任一正解
  const isCorrect = isGiveAll ? true : isAnswered && validAnswers.includes(userAnswer);

  return {
    isCorrect,
    isGiveAll,
    isAnswered,
  };
}

/**
 * 將正解陣列格式化為易讀中文顯示文字。
 *
 * @param {Object} question - 標準化題目物件。
 * @returns {string} 格式化後的正解說明文字。
 */
export function formatCorrectAnswer(question) {
  // 若為一律給分直接回傳說明
  if (Array.isArray(question.answers) && question.answers.includes("ALL")) {
    return "一律給分";
  }
  // 複數正解以斜線分隔顯示
  return Array.isArray(question.answers) ? question.answers.join(" 或 ") : question.rawAnswer || "";
}

/**
 * 計算整份考卷的評分報告、分科統計與答錯題目清單。
 *
 * @param {Array<Object>} questions - 考卷題目物件陣列。
 * @param {Record<string, string>} userAnswers - 使用者作答字典（鍵為題目 ID，值為選項代碼）。
 * @param {Set<string>} flaggedIds - 使用者標記待確認之題目 ID 集合。
 * @returns {Object} 完整成績報告物件。
 */
export function scoreExam(questions, userAnswers, flaggedIds) {
  // 總題數
  const totalCount = questions.length;
  // 答對題數計數器
  let correctCount = 0;
  // 未作答題數計數器
  let unansweredCount = 0;
  // 逐題評分明細陣列
  const details = [];
  // 答錯題目陣列（供寫入錯題本使用）
  const wrongQuestions = [];
  // 各科統計暫存物件
  const subjectStatsMap = {};

  for (let i = 0; i < totalCount; i += 1) {
    const question = questions[i];
    const selected = userAnswers[question.id] || null;
    const evalResult = evaluateSingleQuestion(question, selected);

    if (evalResult.isCorrect) {
      correctCount += 1;
    } else {
      wrongQuestions.push(question);
    }

    if (!evalResult.isAnswered) {
      unansweredCount += 1;
    }

    // 累加分科正確率統計
    if (!subjectStatsMap[question.subject]) {
      subjectStatsMap[question.subject] = {
        subject: question.subject,
        total: 0,
        correct: 0,
      };
    }
    subjectStatsMap[question.subject].total += 1;
    if (evalResult.isCorrect) {
      subjectStatsMap[question.subject].correct += 1;
    }

    // 記錄逐題檢討明細
    details.push({
      index: i + 1,
      question,
      userAnswer: selected,
      isCorrect: evalResult.isCorrect,
      isGiveAll: evalResult.isGiveAll,
      isAnswered: evalResult.isAnswered,
      isFlagged: flaggedIds.has(question.id),
    });
  }

  // 計算百分制總分（取至小數點後一位）
  const score = totalCount > 0 ? Number(((correctCount / totalCount) * 100).toFixed(1)) : 0;

  // 將分科統計轉為陣列並計算正確率百分比
  const subjectBreakdown = Object.values(subjectStatsMap).map((stat) => ({
    ...stat,
    accuracy: stat.total > 0 ? Number(((stat.correct / stat.total) * 100).toFixed(1)) : 0,
  }));

  return {
    totalCount,
    correctCount,
    wrongCount: totalCount - correctCount,
    unansweredCount,
    score,
    subjectBreakdown,
    details,
    wrongQuestions,
  };
}
