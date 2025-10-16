// Kiểm tra học sinh đã làm bài trước đó chưa

const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

const SPREADSHEET_ID = '1qL9ZtIzB_IWhGpzQEFAN_RaUVgy3wKKGmls98PzXsEY';
const SHEET_NAME = 'results';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
    }

    try {
        const { className, stt, name } = req.body;
        const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

        const auth = new JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const range = `${SHEET_NAME}!A:C`; // Cột STT, Lớp, Tên
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        const rows = response.data.values || [];

        const submitted = rows.some(row => {
            const [rowStt, rowClass, rowName] = row.map(cell => String(cell || '').trim().toLowerCase());
            return (
                rowStt === String(stt).trim().toLowerCase() &&
                rowClass === String(className).trim().toLowerCase() &&
                rowName === String(name).trim().toLowerCase()
            );
        });

        res.status(200).json({ submitted });

    } catch (error) {
        console.error('Lỗi khi kiểm tra kết quả:', error);
        res.status(500).json({ error: 'Lỗi máy chủ khi kiểm tra kết quả.', details: error.message });
    }
};
