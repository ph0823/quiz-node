const quizContainer = document.getElementById('quiz-container');
const submitBtn = document.getElementById('submit-btn');
const startBtn = document.getElementById('start-btn');
const resultDiv = document.getElementById('result');

// Thêm các biến DOM mới cho việc chọn lớp/stt
const studentClassInput = document.getElementById('student-class');
const studentSttInput = document.getElementById('student-stt');
const studentNameInput = document.getElementById('student-name');

let questions = [];
// Lưu trữ đáp án của người dùng: {ID_cau_hoi: [dap_an_chon_1, dap_an_chon_2, ...]}
let userAnswers = {}; 
let studentInfo = {name:'', class: '', stt: ''};

// Biến lưu trữ toàn bộ danh sách lớp (từ sheet dsLop)
let allStudentList = [];

//Kiểm tra dữ liệu đã lưu
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải danh sách lớp trước
    await fetchStudentData();
    
    const savedInfo = localStorage.getItem('studentInfo');
    const savedQuestions = localStorage.getItem('quizQuestions');

    if (savedInfo && savedQuestions) {
        studentInfo = JSON.parse(savedInfo);
        questions = JSON.parse(savedQuestions);
        questions.forEach(q => userAnswers[q.ID] = []);
        document.getElementById('student-info').style.display = 'none';
        startBtn.style.display = 'none';
        quizContainer.style.display = 'block';
        renderQuiz();
        submitBtn.style.display = 'block';
    } else {
        // Gán sự kiện lắng nghe chỉ khi đang ở màn hình nhập thông tin (chưa làm bài)
        studentClassInput.addEventListener('change', handleStudentDataChange);
        studentSttInput.addEventListener('input', handleStudentDataChange);

        // Khôi phục lại dữ liệu nếu có
        if (studentInfo.class) studentClassInput.value = studentInfo.class;
        if (studentInfo.stt) studentSttInput.value = studentInfo.stt;
        // Chạy lại hàm xử lý để tự động điền Tên (nếu đã tải xong danh sách)
        if (studentClassInput.value && studentSttInput.value) {
            handleStudentDataChange();
        }
    }
});

// Hàm hỗ trợ: Chuyển chuỗi đáp án (từ Excel) thành mảng các chuỗi chuẩn hóa.
function parseCorrectAnswer(correctAnswerString) {
    if (!correctAnswerString) return [];
    // Tách chuỗi, chuyển thành chữ hoa, loại bỏ khoảng trắng.
    return String(correctAnswerString).toUpperCase().split(',').map(s => s.trim()).filter(s => s);
}

//Hàm trộn mảng dùng cho câu hỏi/đáp án
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ----------------------------------------------------
// LOGIC MỚI: Tải danh sách lớp và Tự động điền Tên
// ----------------------------------------------------

// 1. Lấy dữ liệu danh sách lớp từ Serverless Function (/api/student)
async function fetchStudentData() {
    studentClassInput.innerHTML = '<option value="">-- Đang tải Lớp... --</option>';
    try {
        // Gọi API Vercel Serverless Function (đã tạo ở bước 3)
        const response = await fetch('/api/student'); 
        const json = await response.json();
        
        if (json.data && json.data.length > 0) {
            allStudentList = json.data;
            // Điền các lớp duy nhất vào ô chọn Lớp (Select)
            populateClassDropdown();
        } else {
            console.warn('Không tìm thấy dữ liệu danh sách lớp (sheet dsLop).');
            studentClassInput.innerHTML = '<option value="">-- Lỗi tải lớp --</option>';
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp:", error);
        studentClassInput.innerHTML = '<option value="">-- Lỗi kết nối --</option>';
    }
}

function populateClassDropdown() {
    // Giả sử input Lớp là thẻ <select>
    if (studentClassInput.tagName === 'SELECT') {
        // Lấy danh sách các lớp duy nhất
        const uniqueClasses = [...new Set(allStudentList.map(s => String(s.Lop || '').trim()))].filter(c => c);

        // Tạo các option
        studentClassInput.innerHTML = '<option value="">-- Chọn Lớp --</option>';
        uniqueClasses.sort().forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            studentClassInput.appendChild(option);
        });
    }
}

// 2. Xử lý sự kiện khi thay đổi Lớp hoặc nhập STT
function handleStudentDataChange() {
    const selectedClass = studentClassInput.value.trim();
    const stt = studentSttInput.value.trim();

    // Reset tên
    studentNameInput.value = '';

    if (selectedClass && stt) {
        // Tìm học sinh dựa trên Lớp và STT
        const foundStudent = allStudentList.find(s => 
            // So sánh phải đảm bảo cùng kiểu dữ liệu (chuỗi)
            String(s.Lop || '').trim() === selectedClass && 
            String(s.STT || '').trim() === stt
        );

        if (foundStudent) {
            // Giả sử cột tên trong sheet là 'Ten_hoc_sinh' (hoặc 'Ho_ten')
            const studentName = foundStudent.Ten_hoc_sinh || foundStudent.Ho_ten || foundStudent.Ten; 
            
            if (studentName) {
                studentNameInput.value = String(studentName).trim();
            } else {
                studentNameInput.value = 'Không tìm thấy tên (Lỗi dữ liệu)';
            }
        } else {
            // studentNameInput.value = ''; // Giữ trống
            console.log(`Không tìm thấy học sinh Lớp: ${selectedClass}, STT: ${stt}`);
        }
    }
}

// Đếm thời gian làm bài
let timerInterval;
let totalTime = 10 * 60; // ví dụ: 10 phút = 600 giây

function startTimer() {
  const timerDisplay = document.getElementById('timer');
  const timerBox = document.getElementById('timer-box');
  timerBox.style.display = 'block';

  let timeLeft = totalTime;

  timerInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = 'Hết giờ';
      alert('⏰ Hết thời gian làm bài!');
      document.getElementById('submit-btn').click(); // Tự động nộp bài
    }

    timeLeft--;
  }, 1000);
}


// ----------------------------------------------------
// LOGIC BÀI KIỂM TRA
// ----------------------------------------------------

// Xử lý khi nhấn nút "Làm bài"
startBtn.addEventListener('click', () => {
    // Lấy giá trị đã tự động điền
    const name = studentNameInput.value.trim(); 
    const className = studentClassInput.value.trim();
    const stt = studentSttInput.value.trim();

    // Kiểm tra tính hợp lệ
    if (!name || !className || !stt || studentNameInput.disabled === false) {
        alert("Vui lòng chọn Lớp và nhập STT. Hệ thống cần tự động điền Tên học sinh trước khi làm bài.");
        return;
    }
    
    // Nếu tên bị báo lỗi, không cho phép làm bài
    if (name.includes('Không tìm thấy tên')) {
         alert("Lỗi: Không tìm thấy tên học sinh. Vui lòng kiểm tra lại Lớp và STT.");
         return;
    }

    studentInfo.name = name;
    studentInfo.class = className;
    studentInfo.stt = stt;

    document.getElementById('student-info').style.display = 'none';
    startBtn.style.display = 'none';
    quizContainer.style.display = 'block';

    fetchQuestions();
    startTimer();

});

// 1. Lấy dữ liệu câu hỏi từ Serverless Function
async function fetchQuestions() {
    try {
        // Gọi API Vercel Serverless Function (sẽ là /api/questions khi chạy vercel dev)
        const response = await fetch('/api/questions'); 
        const json = await response.json();
        
        if (json.data && json.data.length > 0) {
            questions = json.data;
            // Trộn thứ tự câu hỏi
            shuffleArray(questions);

            // Khởi tạo userAnswers cho mỗi câu hỏi
            questions.forEach(q => {
                // Đảm bảo ID là chuỗi
                q.ID = String(q.ID); 
                userAnswers[q.ID] = [];
            });

            // Lưu nội dung đề vào localStorage
            localStorage.setItem('studentInfo', JSON.stringify(studentInfo));
            localStorage.setItem('quizQuestions', JSON.stringify(questions));
            
            renderQuiz();
            submitBtn.style.display = 'block';
        } else {
            quizContainer.innerHTML = 'Không tìm thấy câu hỏi nào. Vui lòng kiểm tra file Excel.';
        }
    } catch (error) {
        console.error("Lỗi khi tải câu hỏi:", error);
        quizContainer.innerHTML = 'Lỗi kết nối hoặc lỗi server. Vui lòng chạy bằng "vercel dev".';
    }
}

// 2. Hiển thị các câu hỏi ra giao diện
function renderQuiz() {
    let html = '';
    questions.forEach((q, index) => {
        const isMultiChoice = String(q.Loai_cau_hoi).toLowerCase() === 'multiple';
        const inputType = isMultiChoice ? 'checkbox' : 'radio';
        const inputName = `question_${q.ID}`;

        html += `
            <div class="question-box" data-id="${q.ID}" data-type="${isMultiChoice ? 'multi' : 'single'}">
                <h4>Câu ${index + 1} (${isMultiChoice ? 'Nhiều đáp án' : 'Một đáp án'}): ${q.Cau_hoi}</h4>
                ${q.Hinh_anh ? `<img src="/images/${q.Hinh_anh}" alt="Minh họa" style="max-width: 100%; height: auto; margin-bottom: 15px; border-radius: 4px;">` : ''}
                <div class="options">
        `;

        //Trộn thứ tự đáp án
        const answerOptions = shuffleArray([
            { key: 'A', value: q.Dap_an_A },
            { key: 'B', value: q.Dap_an_B },
            { key: 'C', value: q.Dap_an_C },
            { key: 'D', value: q.Dap_an_D }
        ]);

        answerOptions.forEach(opt => {
            const displayValue = opt.value ? String(opt.value) : ''; 
            if (displayValue) { 
                html += `
                    <label class="option-label">
                        <input 
                            type="${inputType}" 
                            name="${inputName}" 
                            value="${opt.key}"
                            data-q-id="${q.ID}"
                            onchange="handleOptionChange(event)"
                        >
                        <span>${opt.key}. ${displayValue}</span>
                    </label>
                `;
            }
        });

        html += `
                </div>
            </div>
        `;
    });
    quizContainer.innerHTML = html;
}

// 3. Xử lý sự kiện khi người dùng thay đổi lựa chọn (Lưu đáp án)
function handleOptionChange(event) {
    const inputElement = event.target;
    const questionId = inputElement.dataset.qId;
    const answerKey = inputElement.value;
    const inputType = inputElement.type;

    if (inputType === 'radio') {
        // Single-choice: Ghi đè chỉ với 1 đáp án mới
        userAnswers[questionId] = [answerKey];
    } else if (inputType === 'checkbox') {
        // Multi-choice: Thêm/Xóa đáp án
        let currentAnswers = userAnswers[questionId] || [];

        if (inputElement.checked) {
            // Thêm đáp án nếu nó chưa có trong mảng
            if (!currentAnswers.includes(answerKey)) {
                currentAnswers.push(answerKey);
            }
        } else {
            // Xóa đáp án
            const index = currentAnswers.indexOf(answerKey);
            if (index > -1) {
                currentAnswers.splice(index, 1);
            }
        }
        // Ghi lại mảng đáp án đã được cập nhật
        userAnswers[questionId] = currentAnswers;
    }
}

// 4. Xử lý khi nộp bài và chấm điểm
submitBtn.addEventListener('click', () => {

    clearInterval(timerInterval); // Dừng đếm thời gian
    document.getElementById('timer-box').style.display = 'none'; // Ẩn bộ đếm

    let score = 0;
    let quizReview = []; // Lưu trữ kết quả chi tiết từng câu hỏi
    
    questions.forEach((q, index) => {
        const correctAnswers = parseCorrectAnswer(q.Dap_an_dung);      
        const userSelectedAnswers = userAnswers[q.ID] || [];          
        
        // --- LOGIC CHẤM ĐIỂM (So sánh chuỗi JSON đã sắp xếp) ---
        // Sắp xếp cả hai mảng để so sánh tập hợp (set comparison)
        const sortedCorrect = [...correctAnswers].sort();
        const sortedUser = [...userSelectedAnswers].sort();

        const sortedCorrectStr = JSON.stringify(sortedCorrect);
        const sortedUserStr = JSON.stringify(sortedUser);

        const isCorrect = sortedCorrectStr === sortedUserStr;

        if (isCorrect) {
            score++;
        }
        
        // Lưu kết quả review chi tiết
        quizReview.push({
            index: index + 1,
            question: q.Cau_hoi,
            isCorrect: isCorrect,
            correct: correctAnswers, // Vẫn lưu để tính toán, nhưng không hiển thị
            user: userSelectedAnswers,
            explanation: q.Giai_thich,
            options: [q.Dap_an_A, q.Dap_an_B, q.Dap_an_C, q.Dap_an_D]
        });
    });

    // Chuyển sang trang kết quả
    renderResults(score, quizReview);

    // lưu kết quả vào file Data/Results.xlxs
    const timestamp = new Date().toLocaleString('vi-VN');

    fetch('/api/saveResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentInfo,
            score,
            total: questions.length,
            timestamp,
            answers: quizReview
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log('Kết quả đã được lưu:', data.message);
    })
    .catch(err => {
        console.error('Lỗi khi gửi kết quả:', err);
    });

    //------------/

    // Xóa dữ liệu bài làm sau khi nộp bài
    localStorage.removeItem('studentInfo');
    localStorage.removeItem('quizQuestions');
});

// 5. Hiển thị trang kết quả chi tiết (Chỉ hiển thị câu sai và đáp án người dùng chọn)
function renderResults(score, reviewData) {
    // Ẩn nút nộp bài và xóa giao diện câu hỏi
    submitBtn.style.display = 'none';
    quizContainer.innerHTML = '';

    const total = reviewData.length;
    const incorrect = total - score;

    let html = `
        <div class="result-summary text-center">
            <h2>Kết Quả Bài Trắc Nghiệm</h2>
            <p><strong>Lớp:</strong> ${studentInfo.class}<strong> -- STT:</strong> ${studentInfo.stt}</p>
            <p><strong>Họ và tên:</strong> ${studentInfo.name}</p>            
            
            <div class="score-display">
                <p style="color: green;">Tổng điểm: <strong>${score}/${total}</strong></p>                
                <p style="color: red;">Số câu sai: ${incorrect}</p>
            </div>
            
        </div>
        <hr>
        <h3 style="color: blue;">Các Câu Trả Lời Sai (${incorrect} câu)</h3>
        <ul class="review-list" style="list-style-type: none; padding-left: 0;">
    `;

    const answerLetters = ['A', 'B', 'C', 'D'];

    reviewData.filter(item => !item.isCorrect).forEach(item => {
        let reviewDetail = '';

        for (let i = 0; i < 4; i++) {
            const letter = answerLetters[i];
            const answerText = item.options[i] ? String(item.options[i]) : '';
            if (!answerText) continue;

            let style = '';
            let indicator = '';

            if (item.user.includes(letter)) {
                style = 'background-color: #e9f5ff; border-color: #007bff; font-weight: bold; color: #007bff; border: 1px dashed;';
                indicator = '';
            }

            reviewDetail += `<li style="${style} padding: 8px; margin-bottom: 5px; border-radius: 4px;"><strong>${letter}.</strong> ${answerText}${indicator}</li>`;
        }

        html += `
            <li class="review-item" style="border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
                <h4>Câu ${item.index}: ${item.question}</h4>
                <div style="margin-top: 10px; padding: 10px; border: 1px dashed #adb5bd; border-radius: 4px; background-color: #f8f9fa;">
                    Đáp án bạn đã chọn: <strong>${item.user.length > 0 ? item.user.join(', ') : '(Chưa chọn)'}</strong>
                </div>
                <ul style="list-style-type: none; padding: 10px 0;">${reviewDetail}</ul>
                ${item.explanation ? `<p style="font-size: 0.9em; padding: 10px; background-color: #f0f0f0; border-radius: 4px;"><strong>Giải thích:</strong> ${item.explanation}</p>` : ''}
            </li>
        `;
    });

    html += '</ul>';

    if (incorrect === 0) {
        html += '<p style="text-align: center; color: green; font-size: 1.2em;">Chúc mừng! Bạn đã trả lời đúng tất cả các câu hỏi.</p>';
    }

    resultDiv.innerHTML = html;
}
