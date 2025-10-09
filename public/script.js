async function loadQuestions() {
  const res = await fetch('/api/questions');
  const questions = await res.json();
  const form = document.getElementById('quiz-form');

  questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.innerHTML = `<p><strong>${i + 1}. ${q.question}</strong></p>`;
    q.options.forEach((opt, j) => {
      const letter = String.fromCharCode(65 + j);
      const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
      div.innerHTML += `
        <label>
          <input type="${inputType}" name="q${i}" value="${letter}"> ${opt}
        </label><br>`;
    });
    form.appendChild(div);
  });
}

async function submitQuiz() {
  const formData = new FormData(document.getElementById('quiz-form'));
  const answers = {};

  for (let [key, value] of formData.entries()) {
    if (!answers[key]) answers[key] = [];
    answers[key].push(value);
  }

  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers)
  });

  const result = await res.json();
  alert(`Bạn đúng ${result.score} / ${result.total} câu`);
}

loadQuestions();
