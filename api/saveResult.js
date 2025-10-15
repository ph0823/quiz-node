// Lưu trên Google Sheets
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

// >>> CẬP NHẬT ID SHEET CỦA BẠN TẠI ĐÂY <<<
const SPREADSHEET_ID = '1qL9ZtIzB_IWhGpzQEFAN_RaUVgy3wKKGmls98PzXsEY';
// Tên sheet bạn muốn ghi dữ liệu vào
const SHEET_NAME = 'results'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { studentInfo, score, total, timestamp, answers } = req.body;

        // 1. Tải thông tin tài khoản dịch vụ từ biến môi trường
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // 2. Xác thực JWT (Phương thức được khuyến nghị)
        const auth = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Quyền ghi
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. Chuẩn bị dữ liệu ghi: Hàng tóm tắt (A-F)
        const summaryRow = [
            studentInfo.stt,
            studentInfo.class,
            studentInfo.name,
            timestamp,
            score,
            total
        ];

        // 4. Chuẩn bị dữ liệu ghi: Các hàng chi tiết (A-K)
        const detailedRows = answers.map((item) => ([
            studentInfo.stt,
            studentInfo.class,
            studentInfo.name,
            timestamp,
            '', // E: Cột điểm tổng (chỉ điền ở hàng tóm tắt)
            '', // F: Cột tổng số câu
            item.index,    // G: Câu số
            item.question, // H: Câu hỏi
            item.correct.join(', '), // I: Đáp án đúng
            item.user.join(', '),    // J: Đáp án HS
            item.isCorrect ? 'Đúng' : 'Sai' // K: Kết quả
        ]));

        // Tạo mảng dữ liệu cần ghi, hàng đầu tiên là tóm tắt
        const values = [summaryRow].concat(detailedRows);

        // 5. Ghi dữ liệu vào Google Sheet (Append)
        const range = `${SHEET_NAME}!A:K`; 

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values,
            },
        });

        res.status(200).json({ message: 'Đã lưu kết quả thành công vào Google Sheet.', updates: response.data.updates });

    } catch (error) {
        console.error('Lỗi khi ghi Google Sheet:', error);
        res.status(500).json({ 
            error: 'Lỗi máy chủ khi lưu kết quả lên Google Sheet.', 
            details: error.message 
        });
    }
};