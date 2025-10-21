// api/questions.js
// Import thư viện xác thực và API Google Sheets
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

// >>> CẬP NHẬT ID GOOGLE SHEET CỦA BẠN TẠI ĐÂY <<<
const SPREADSHEET_ID = '1Jhcj54j4QFxHdFcUpIY82Nf9dC8kCs0Qv6QaZNCIp9s';
const SHEET_QUESTION = 'Khoi7'; // Sheet chứa câu hỏi
const SHEET_CONFIG = 'CauHinh';   // Sheet chứa cấu hình chủ đề

module.exports = async (req, res) => {
  try {
    // 1. Đọc thông tin tài khoản dịch vụ từ biến môi trường
    const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // 2. Tạo đối tượng xác thực JWT để truy cập Google Sheets
    const auth = new JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 3. Đọc dữ liệu từ sheet câu hỏi 
    const questionRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_QUESTION}!A:M`, // Giả sử có 13 cột từ A đến M
    });

    const questionRows = questionRes.data.values;
    if (!questionRows || questionRows.length < 2) {
      return res.status(404).json({ error: 'Không có dữ liệu câu hỏi trong Google Sheet.' });
    }

    const questionHeaders = questionRows[0];
    const allQuestions = questionRows.slice(1).map(row => {
      let question = {};
      questionHeaders.forEach((header, index) => {
        question[header] = row[index] || '';
      });
      return question;
    });

    // 4. Đọc dữ liệu từ sheet cấu hình )
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONFIG}!C:D`, // Giả sử có 2 cột: Chủ đề, Số câu
    });

    const configRows = configRes.data.values;
    if (!configRows || configRows.length < 2) {
      return res.status(404).json({ error: 'Không có dữ liệu cấu hình chủ đề trong Google Sheet.' });
    }

    const configHeaders = configRows[0];
    const configData = configRows.slice(1).map(row => {
      let config = {};
      configHeaders.forEach((header, index) => {
        config[header] = row[index];
      });
      return config;
    });

    // 5. Tạo cấu hình chủ đề: { 'Chủ đề A': 5, 'Chủ đề B': 3, ... }
    const topicConfig = {};
    configData.forEach(row => {
      const topic = String(row['Chu_de']).trim();
      const count = parseInt(row['So_luong']);
      if (topic && !isNaN(count)) {
        topicConfig[topic] = count;
      }
    });

    // 6. Lọc câu hỏi theo từng chủ đề và số lượng
    let selectedQuestions = [];

    for (const topic in topicConfig) {
      const count = topicConfig[topic];
      const topicQuestions = allQuestions.filter(q => String(q['Chu_de']).trim().toLowerCase() === topic.toLowerCase());
      selectedQuestions = selectedQuestions.concat(topicQuestions.slice(0, count));
    }

    // 7. Trả về danh sách câu hỏi đã chọn
    res.status(200).json({ data: selectedQuestions });

  } catch (error) {
    console.error('Lỗi khi xử lý Google Sheet:', error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.', details: error.message });
  }
};





/*
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');


module.exports = async (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'questions.xlsx');
    console.log("Đường dẫn đang kiểm tra:", filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Không tìm thấy file câu hỏi." });
    }

    const workbook = XLSX.readFile(filePath);

    // Đọc sheet câu hỏi
    const questionSheet = workbook.Sheets['DSCau'];
    const allQuestions = XLSX.utils.sheet_to_json(questionSheet, {
      header: [
        "ID", "Chu_de", "Loai_cau_hoi", "Cau_hoi",
        "Dap_an_A", "Dap_an_B", "Dap_an_C", "Dap_an_D",
        "Dap_an_dung", "Do_kho", "Giai_thich", "Hinh_anh"
      ],
      range: 1
    });

    // Đọc sheet cấu hình
    const configSheet = workbook.Sheets['ChuDe'];
    const configData = XLSX.utils.sheet_to_json(configSheet, {
      header: ["Chu_de", "So_luong"],
      range: 1
    });

    // Tạo cấu hình chủ đề: { 'Chủ đề A': 5, 'Chủ đề B': 3, ... }
    const topicConfig = {};
    configData.forEach(row => {
      const topic = String(row.Chu_de).trim();
      const count = parseInt(row.So_luong);
      if (topic && !isNaN(count)) {
        topicConfig[topic] = count;
      }
    });

    // Lọc câu hỏi theo từng chủ đề và số lượng
    let selectedQuestions = [];

    for (const topic in topicConfig) {
      const count = topicConfig[topic];
      const topicQuestions = allQuestions.filter(q => String(q.Chu_de).trim().toLowerCase() === topic.toLowerCase());
      selectedQuestions = selectedQuestions.concat(topicQuestions.slice(0, count));
    }

    res.status(200).json({ data: selectedQuestions });

  } catch (error) {
    console.error("Lỗi khi xử lý file Excel:", error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
  }
};
*/

