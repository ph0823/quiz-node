const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Đổi thành ID Google Sheet của bạn
const SPREADSHEET_ID = '1bMFG63tiI26zihr8BD-7Hs2hNsW0bnoc';
// Đổi thành tên sheet bạn muốn đọc dữ liệu
const SHEET_NAME = 'results'; 

module.exports = async (req, res) => {
    try {
        // 1. Tải thông tin tài khoản dịch vụ từ biến môi trường
        // PHẢI sử dụng Service Account Key vì đây là hàm Server-side
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // 2. Xác thực với Google Sheets API
        const auth = new GoogleAuth({
            credentials: keyFile,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Chỉ cần quyền đọc
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. Đọc toàn bộ dữ liệu từ Sheet
        // Giả định dữ liệu nằm trong phạm vi từ A đến F (các cột tóm tắt chính)
        const range = `${SHEET_NAME}!A:F`; 
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        // Hàng đầu tiên thường là Header
        const [header, ...rows] = response.data.values || [];
        
        if (rows.length === 0) {
             return res.status(200).json({ data: [] });
        }

        // 4. Xử lý logic Gom nhóm dữ liệu
        const grouped = {};
        
        // Cấu trúc dữ liệu đọc về: [STT, Lớp, Họ tên, Thời gian nộp, Điểm tổng, Tổng số câu]
        rows.forEach(row => {
            const [STT, Lop, HoTen, ThoiGianNop, DiemTong, TongSoCau] = row;
            
            // Chỉ lấy các hàng tóm tắt (Hàng có Điểm tổng và Tổng số câu được điền)
            if (DiemTong && TongSoCau) {
                 const key = `${STT}_${HoTen}_${Lop}_${ThoiGianNop}`;
                 
                 // Chỉ thêm nếu chưa có (Tránh trùng lặp nếu sheet có lỗi)
                 if (!grouped[key]) {
                     grouped[key] = {
                         stt: STT,
                         name: HoTen,
                         class: Lop,
                         time: ThoiGianNop,
                         score: parseFloat(DiemTong),
                         total: parseFloat(TongSoCau)
                     };
                 }
            }
        });

        // 5. Trả về kết quả
        const resultList = Object.values(grouped).sort((a, b) => {
            // Sắp xếp lại theo STT (Nếu STT là số)
            return parseInt(a.stt) - parseInt(b.stt);
        });

        res.status(200).json({ data: resultList });

    } catch (error) {
        console.error("Lỗi khi đọc Google Sheet:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi đọc bảng điểm." });
    }
};

/*
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
*/