// Import thư viện xác thực và API Google Sheets
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

// >>> CẬP NHẬT ID GOOGLE SHEET CỦA BẠN TẠI ĐÂY <<<
const SPREADSHEET_ID = '1Jgf2n-SRncTlWcoyTLHv9TR1FUZujLy9WkEhX5PyH4Y';
// Tên sheet chứa danh sách học sinh
const SHEET_NAME = 'dsLop';

module.exports = async (req, res) => {
    // Chỉ chấp nhận phương thức GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 1. Đọc thông tin tài khoản dịch vụ từ biến môi trường
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // 2. Tạo đối tượng xác thực JWT để truy cập Google Sheets
        const auth = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Chỉ đọc dữ liệu
        });

        // 3. Khởi tạo client Google Sheets API
        const sheets = google.sheets({ version: 'v4', auth });

        // 4. Đọc dữ liệu từ sheet 'dsLop', cột B đến D (Lớp, STT, Tên học sinh)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!B:D`, // Điều chỉnh nếu cột thay đổi
        });

        const rows = response.data.values;

        // 5. Kiểm tra nếu không có dữ liệu
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Không có dữ liệu trong Google Sheet.' });
        }

        // 6. Lấy hàng đầu tiên làm tiêu đề cột
        const headers = rows[0];

        // 7. Chuyển đổi dữ liệu thành mảng đối tượng học sinh
        const students = rows.slice(1).map(row => {
            let student = {};
            headers.forEach((header, index) => {
                // Chuẩn hóa tên cột: thay khoảng trắng bằng dấu gạch dưới
                let key = String(header).replace(/\s+/g, '_');

                // Đặt tên cột chuẩn để dễ dùng ở frontend
                if (key.toUpperCase().includes('STT')) key = 'STT';
                else if (key.toUpperCase().includes('LƠP') || key.toUpperCase().includes('LOP')) key = 'Lop';
                else if (key.toUpperCase().includes('TEN')) key = 'Ten_hoc_sinh';

                // Gán giá trị tương ứng từ hàng dữ liệu
                student[key] = row[index];
            });
            return student;
        });

        // 8. Trả về dữ liệu dưới dạng JSON
        res.status(200).json({ success: true, data: students });

    } catch (error) {
        // 9. Xử lý lỗi và trả về thông báo lỗi chi tiết
        console.error('Lỗi khi đọc Google Sheet:', error);
        res.status(500).json({ 
            error: 'Lỗi server khi đọc Google Sheet.', 
            details: error.message 
        });
    }
};




/*
const path = require('path');
const xlsx = require('xlsx');

// Đường dẫn tuyệt đối đến file Excel
const excelFilePath = path.join(process.cwd(), 'data', 'questions.xlsx');

module.exports = (req, res) => {
    // Chỉ chấp nhận phương thức GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 1. Đọc file Excel
        const workbook = xlsx.readFile(excelFilePath);
        
        // 2. Lấy tên sheet là 'dsLop'
        const sheetName = 'dsLop';
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
            return res.status(404).json({ error: `Sheet "${sheetName}" không tồn tại trong file Excel.` });
        }
        
        // 3. Chuyển đổi dữ liệu từ sheet thành JSON array
        // header: 1 (Lấy hàng đầu tiên làm tiêu đề cột)
        const studentData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Lấy tiêu đề cột (hàng đầu tiên)
        const headers = studentData[0];
        
        // Ánh xạ dữ liệu
        const formattedStudents = studentData.slice(1).map(row => {
            let student = {};
            headers.forEach((header, index) => {
                // Chuẩn hóa tên cột để dễ sử dụng (ví dụ: loại bỏ khoảng trắng, dấu tiếng Việt)
                let key = String(header).replace(/\s+/g, '_'); 
                
                // Giả sử các cột quan trọng là STT, LOP, TEN (TÊN)
                if (key.toUpperCase().includes('STT')) {
                    key = 'STT';
                } else if (key.toUpperCase().includes('LƠP') || key.toUpperCase().includes('LOP')) {
                    key = 'Lop';
                } else if (key.toUpperCase().includes('TEN') || key.toUpperCase().includes('HO_TEN')) {
                    key = 'Ten_hoc_sinh';
                }

                student[key] = row[index];
            });
            return student;
        });

        res.status(200).json({ 
            success: true, 
            data: formattedStudents 
        });

    } catch (error) {
        console.error('Lỗi khi xử lý file Excel (dsLop):', error);
        res.status(500).json({ 
            error: 'Lỗi server khi đọc file Excel.', 
            details: error.message 
        });
    }
};
*/