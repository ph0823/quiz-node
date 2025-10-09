export default async function handler(req, res) {
  const submitted = req.body;
  const questions = await fetch(`${process.env.VERCEL_URL}/api/questions`).then(r => r.json());
  let score = 0;

  questions.forEach((q, i) => {
    const correct = q.answer.sort().join(',');
    const user = (submitted[`q${i}`] || []).sort().join(',');
    if (correct === user) score++;
  });

  res.status(200).json({ score, total: questions.length });
}
