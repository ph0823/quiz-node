
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

// >>> CẬP NHẬT ID SHEET CỦA BẠN TẠI ĐÂY <<<
const SPREADSHEET_ID = '1bMFG63tiI26zihr8BD-7Hs2hNsW0bnoc';
// Tên sheet bạn muốn đọc dữ liệu
const SHEET_NAME = 'results'; 

module.exports = async (req, res) => {
    try {
        // 1. Tải thông tin tài khoản dịch vụ từ biến môi trường
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // 2. Xác thực JWT (Phương thức được khuyến nghị)
        const auth = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Chỉ cần quyền đọc
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. Đọc dữ liệu tóm tắt từ Sheet (Cột A đến F)
        const range = `${SHEET_NAME}!A:F`; 
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        // Hàng đầu tiên thường là Header, bỏ qua
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
                 
                 // Chỉ thêm nếu chưa có (lấy kết quả nộp đầu tiên/duy nhất)
                 if (!grouped[key]) {
                     grouped[key] = {
                         stt: STT,
                         name: HoTen,
                         class: Lop,
                         time: ThoiGianNop,
                         // Chuyển sang số để sắp xếp và hiển thị dễ hơn
                         score: parseFloat(DiemTong) || 0,
                         total: parseFloat(TongSoCau) || 0
                     };
                 }
            }
        });

        // 5. Trả về kết quả
        const resultList = Object.values(grouped).sort((a, b) => {
            // Sắp xếp lại theo STT
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