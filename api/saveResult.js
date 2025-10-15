// Lưu trên Google Sheets
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Đổi thành ID Google Sheet của bạn
const SPREADSHEET_ID = '1bMFG63tiI26zihr8BD-7Hs2hNsW0bnoc';
// Đổi thành tên sheet bạn muốn ghi dữ liệu vào
const SHEET_NAME = 'results'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { studentInfo, score, total, timestamp, answers } = req.body;

        // 1. Tải thông tin tài khoản dịch vụ từ biến môi trường
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // 2. Xác thực với Google Sheets API
        const auth = new GoogleAuth({
            credentials: keyFile,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Quyền truy cập để ghi sheet
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. Chuẩn bị dữ liệu ghi: Ghi tóm tắt kết quả
        const summaryRow = [
            studentInfo.stt,
            studentInfo.class,
            studentInfo.name,
            timestamp,
            score,
            total
        ];

        // 4. Chuẩn bị dữ liệu ghi: Ghi chi tiết từng câu trả lời
        const detailedRows = answers.map((item) => ([
            studentInfo.stt,
            studentInfo.class,
            studentInfo.name,
            timestamp,
            '', // Cột điểm tổng (chỉ điền ở hàng tóm tắt)
            '', // Cột tổng số câu
            item.index,
            item.question,
            item.correct.join(', '),
            item.user.join(', '),
            item.isCorrect ? 'Đúng' : 'Sai'
        ]));

        // Tạo mảng dữ liệu cần ghi, hàng đầu tiên là tóm tắt
        const values = [summaryRow].concat(detailedRows);

        // 5. Ghi dữ liệu vào Google Sheet
        // Bạn nên thiết lập header cố định trong sheet (ví dụ: STT, Lớp, Họ tên, Thời gian nộp, Điểm tổng, Tổng số câu,...)
        const range = `${SHEET_NAME}!A:K`; // Giả định dữ liệu ghi từ cột A đến K

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED', // Để Google Sheets tự động định dạng
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values,
            },
        });

        res.status(200).json({ message: 'Đã lưu kết quả thành công vào Google Sheet.', updates: response.data.updates });

    } catch (error) {
        console.error('Lỗi khi ghi Google Sheet:', error);
        // Trả về lỗi chi tiết hơn nếu có thể
        res.status(500).json({ 
            error: 'Lỗi máy chủ khi lưu kết quả lên Google Sheet.', 
            details: error.message 
        });
    }
};



/* 
// Lưu trên Excel
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

*/
