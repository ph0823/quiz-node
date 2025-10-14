const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'Results.xlsx');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Không tìm thấy file Results.xlsx." });
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['results'];
    if (!sheet) {
      return res.status(400).json({ error: "Không tìm thấy sheet 'results'." });
    }

    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Gom dữ liệu theo học sinh (dựa trên STT + Họ tên + Lớp + Thời gian nộp)
    const grouped = {};
    rawData.forEach(row => {
      const key = `${row.STT}_${row['Họ tên']}_${row['Lớp']}_${row['Thời gian nộp']}`;
      if (!grouped[key] && row['Điểm tổng'] !== '') {
        grouped[key] = {
          stt: row.STT,
          name: row['Họ tên'],
          class: row['Lớp'],
          time: row['Thời gian nộp'],
          score: parseInt(row['Điểm tổng']),
          total: parseInt(row['Tổng số câu'])
        };
      }
    });

    const resultList = Object.values(grouped).sort((a, b) => parseInt(a.stt) - parseInt(b.stt));
    res.status(200).json({ data: resultList });
  } catch (error) {
    console.error("Lỗi khi đọc file Results.xlsx:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đọc bảng điểm." });
  }
};
