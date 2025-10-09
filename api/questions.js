import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), 'questions.xlsx');
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const questions = rows.map((row, i) => ({
    id: i + 1,
    question: row['Câu hỏi'],
    options: [row['A'], row['B'], row['C'], row['D']],
    answer: row['Đáp án'].split(','),
    type: row['Loại']
  }));

  res.status(200).json(questions);
}
