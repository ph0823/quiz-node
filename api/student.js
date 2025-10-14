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
