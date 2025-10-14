// api/questions.js
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

