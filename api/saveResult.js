const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    const { studentInfo, score, total, timestamp, answers } = req.body;

    const filePath = path.join(process.cwd(), 'data', 'Results.xlsx');
    let workbook, worksheet;

    // Nếu file tồn tại, đọc workbook và sheet
    if (fs.existsSync(filePath)) {
      workbook = XLSX.readFile(filePath);
      worksheet = workbook.Sheets['results'] || XLSX.utils.aoa_to_sheet([]);
    } else {
      workbook = XLSX.utils.book_new();
      worksheet = XLSX.utils.aoa_to_sheet([]);
    }

    // Chuyển sheet thành mảng dữ liệu
    const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const header = [
      'STT', 'Lớp', 'Họ tên', 'Thời gian nộp',
      'Câu số', 'Câu hỏi', 'Đáp án đúng', 'Đáp án học sinh',
      'Kết quả', 'Điểm tổng', 'Tổng số câu'
    ];

    // Nếu chưa có header, thêm vào
    if (existingData.length === 0) {
      existingData.push(header);
    }

    // Ghi từng dòng kết quả cho học sinh
    answers.forEach((item, index) => {
      existingData.push([
        studentInfo.stt,
        studentInfo.class,
        studentInfo.name,        
        timestamp,
        item.index,
        item.question,
        item.correct.join(', '),
        item.user.join(', '),
        item.isCorrect ? 'Đúng' : 'Sai',
        index === 0 ? score : '',
        index === 0 ? total : ''
      ]);
    });

    // Tạo lại sheet và ghi đè vào workbook
    const newSheet = XLSX.utils.aoa_to_sheet(existingData);
    workbook.Sheets['results'] = newSheet;

    // Ghi file Excel
    XLSX.writeFile(workbook, filePath);

    res.status(200).json({ message: 'Đã lưu kết quả thành công.' });
  } catch (error) {
    console.error('Lỗi ghi file Excel:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi lưu kết quả.' });
  }
};


