const quizContainer = document.getElementById('quiz-container');
const submitBtn = document.getElementById('submit-btn');
const startBtn = document.getElementById('start-btn');
const resultDiv = document.getElementById('result');

// Thêm các biến DOM mới cho việc chọn lớp/stt
const studentClassInput = document.getElementById('student-class');
const studentSttInput = document.getElementById('student-stt');
const studentNameInput = document.getElementById('student-name');

// biến lưu trữ trạng thái đã làm bài
let hasSubmitted = false;

let questions = [];
// Lưu trữ đáp án của người dùng: {ID_cau_hoi: [dap_an_chon_1, dap_an_chon_2, ...]}
let userAnswers = {}; 
let studentInfo = {name:'', class: '', stt: ''};

// Biến lưu trữ toàn bộ danh sách lớp (từ sheet dsLop)
let allStudentList = [];

// ====================================================================================================================
// --- KHỞI TẠO VÀ TẢI DỮ LIỆU ---
// ====================================================================================================================

//Kiểm tra dữ liệu đã lưu
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải danh sách lớp trước
    await fetchStudentData();
    
    // 2. Khôi phục dữ liệu nếu có từ localStorage (nhưng không hiển thị ngay phần làm bài)
    const savedInfo = localStorage.getItem('studentInfo');
    const savedQuestions = localStorage.getItem('quizQuestions');
    const savedUserAnswers = localStorage.getItem('userAnswers');

    if (savedInfo && savedQuestions) {
        // Khôi phục đề cũ nếu đã từng nhấn nút "Làm bài"
        studentInfo = JSON.parse(savedInfo);
        questions = JSON.parse(savedQuestions);
        userAnswers = savedUserAnswers ? JSON.parse(savedUserAnswers) : {}; // Khôi phục userAnswers
        
        // Hiển thị lại bài làm dang dở
        document.getElementById('student-info').style.display = 'none';
        startBtn.style.display = 'none';
        quizContainer.style.display = 'block';
        renderQuiz();
        submitBtn.style.display = 'block';        
        startTimer();
    } else {
        // Gán sự kiện lắng nghe chỉ khi đang ở màn hình nhập thông tin (chưa làm bài)
        studentClassInput.addEventListener('change', handleStudentDataChange);
        studentSttInput.addEventListener('input', handleStudentDataChange);
    }
});

// Hàm Chuyển chuỗi đáp án thành mảng các chuỗi chuẩn hóa.
function parseCorrectAnswer(correctAnswerString) {
    if (!correctAnswerString) return [];
    // Tách chuỗi, chuyển thành chữ hoa, loại bỏ khoảng trắng.
    return String(correctAnswerString).toUpperCase().split(',').map(s => s.trim()).filter(s => s);
}

//Hàm trộn mảng dùng cho câu hỏi/đáp án
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Hàm kiểm xem đã có nộp bài chưa, nếu nộp -> vô hiệu nút 'Làm bài'
async function checkIfSubmitted() {
  const className = studentClassInput.value.trim();
  const stt = studentSttInput.value.trim();
  const name = studentNameInput.value.trim();

  if (!className || !stt || !name) return;

  try {
    const res = await fetch('/api/checkSubmitted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className, stt, name })
    });

    const data = await res.json();
    if (data.submitted) {
      hasSubmitted = true;  
      alert('Bạn đã hoàn thành bài kiểm tra. Không thể làm lại.');
      startBtn.disabled = true;
      startBtn.style.backgroundColor = '#ccc';
    } else {
      hasSubmitted = false;  
      startBtn.disabled = false;
      startBtn.style.backgroundColor = '#28a745';
    }
  } catch (err) {
    console.error('Lỗi kiểm tra trạng thái đã nộp:', err);
  }
}

// ----------------------------------------------------
// LOGIC: Tải danh sách lớp và Tự động điền Tên
// ----------------------------------------------------

// 1. Lấy dữ liệu danh sách lớp từ Serverless Function (/api/student)
async function fetchStudentData() {
    studentClassInput.innerHTML = '<option value="">-- Đang tải Lớp... --</option>';
    try {
        // Gọi API Vercel Serverless Function 
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
    // input Lớp là thẻ <select>
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
    studentNameInput.disabled = false;

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
                studentNameInput.disabled = true;
                checkIfSubmitted(); // kiểm xem đã có nộp bài chưa, nếu nộp vô hiệu nút Làm bài
            } else {
                studentNameInput.value = 'Không tìm thấy tên (Lỗi dữ liệu)';
                startBtn.disabled = true;
                startBtn.style.backgroundColor = '#ccc';
            }
        } else {
            studentNameInput.value = 'Không tìm thấy học sinh';
            startBtn.disabled = true;
            startBtn.style.backgroundColor = '#ccc';
        }
    }
}


// Đếm thời gian làm bài
let timerInterval;
let totalTime = 10 * 60; // ví dụ: 10 phút = 600 giây
let timeStarted = 0; // Biến lưu thời điểm bắt đầu

function startTimer() {
  const timerDisplay = document.getElementById('timer');
  const timerBox = document.getElementById('timer-box');
  timerBox.style.display = 'block';

  timeStarted = Date.now();
  let timeLeft = totalTime;

  timerInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = 'Hết giờ';
      alert('⏰ Hết thời gian làm bài! Hệ thống tự động nộp bài.');
      document.getElementById('submit-btn').click(); // Tự động nộp bài
    }

    timeLeft--;
  }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const elapsedTimeInSeconds = Math.floor((Date.now() - timeStarted) / 1000);
    const minutes = Math.floor(elapsedTimeInSeconds / 60);
    const seconds = elapsedTimeInSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        alert("Vui lòng chọn Lớp và nhập STT. Hệ thống cần tự động điền Tên học sinh và khóa ô tên trước khi làm bài.");
        return;
    }
    
    // Nếu tên bị báo lỗi, không cho phép làm bài
    if (name.includes('Không tìm thấy tên')) {
         alert("Lỗi: Không tìm thấy tên học sinh. Vui lòng kiểm tra lại Lớp và STT.");
         return;
    }

    if (hasSubmitted) {
        alert("Bạn đã nộp bài trước đó. Không thể làm lại.");
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
            questions = shuffleArray(questions);

            // Khởi tạo userAnswers cho mỗi câu hỏi
            questions.forEach(q => {
                // Đảm bảo ID là chuỗi
                q.ID = String(q.ID); 
                // CHỈ KHỞI TẠO NẾU CHƯA CÓ TRONG userAnswers (từ localStorage)
                if (!userAnswers[q.ID]) {
                    userAnswers[q.ID] = [];
                }
            });

            // Lưu nội dung đề vào localStorage
            localStorage.setItem('studentInfo', JSON.stringify(studentInfo));
            localStorage.setItem('quizQuestions', JSON.stringify(questions));
            
            renderQuiz();
            submitBtn.style.display = 'block';
        } else {
            quizContainer.innerHTML = 'Không tìm thấy câu hỏi nào.';
        }
    } catch (error) {
        console.error("Lỗi khi tải câu hỏi:", error);
        quizContainer.innerHTML = 'Lỗi kết nối hoặc lỗi server.';
    }
}

// 2. Hiển thị các câu hỏi ra giao diện
function renderQuiz() {
    let html = '';
    questions.forEach((q, index) => {
        const isMultiChoice = String(q.Loai_cau_hoi).toLowerCase() === 'multiple';
        const inputType = isMultiChoice ? 'checkbox' : 'radio';
        const inputName = `question_${q.ID}`;
        const currentAnswers = userAnswers[q.ID] || []; // Đảm bảo lấy được đáp án đã lưu

        html += `
            <div class="question-box" data-id="${q.ID}" data-type="${isMultiChoice ? 'multi' : 'single'}">
                <h4>Câu ${index + 1} (${isMultiChoice ? 'Nhiều đáp án' : 'Một đáp án'}): ${q.Cau_hoi}</h4>
                ${q.Hinh_anh ? `<img src="/images/${q.Hinh_anh}" alt="Minh họa" style="max-width: 100%; height: auto; margin-bottom: 15px; border-radius: 4px;">` : ''}
                <div class="options">
        `;

        //Trộn thứ tự đáp án (chỉ những đáp án có nội dung)
        const answerOptions = shuffleArray([
            { key: 'A', value: q.Dap_an_A },
            { key: 'B', value: q.Dap_an_B },
            { key: 'C', value: q.Dap_an_C },
            { key: 'D', value: q.Dap_an_D }
        ]).filter(opt => opt.value && String(opt.value).trim() !== '');

        answerOptions.forEach(opt => {
            const displayValue = String(opt.value); 
            const isChecked = currentAnswers.includes(opt.key);
            
            html += `
                <label class="option-label">
                    <input 
                        type="${inputType}" 
                        name="${inputName}" 
                        value="${opt.key}"
                        data-q-id="${q.ID}"
                        ${isChecked ? 'checked' : ''}
                        onchange="handleOptionChange(event)"
                        >
                    <span>${displayValue}</span>
                    </label>
            `;
        });

        html += `</div></div>`;
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
    
    // Lưu lại userAnswers vào localStorage
    try {
        localStorage.setItem('userAnswers', JSON.stringify(userAnswers));
    } catch (e) {
        console.error("Lỗi khi lưu userAnswers vào localStorage:", e);
    }
}

// 4. Xử lý khi nộp bài và chấm điểm
submitBtn.addEventListener('click', () => {
    if (!confirm('Bạn có chắc chắn muốn nộp bài? Bài làm sẽ không thể thay đổi sau khi nộp.')) {
        return;
    }

    const timeTaken = stopTimer(); // Dừng và lấy thời gian
    document.getElementById('timer-box').style.display = 'none'; // Ẩn bộ đếm

    let score = 0;
    let quizReview = [];
    let submissionDetail = []; // Lưu trữ chi tiết nội dung đáp án (để gửi lên server)
    
    questions.forEach((q, index) => {
        const correctAnswers = parseCorrectAnswer(q.Dap_an_dung);      
        const userSelectedAnswers = userAnswers[q.ID] || [];          
        
        // --- LOGIC CHẤM ĐIỂM ---
        const sortedCorrect = [...correctAnswers].sort();
        const sortedUser = [...userSelectedAnswers].sort();

        const sortedCorrectStr = JSON.stringify(sortedCorrect);
        const sortedUserStr = JSON.stringify(sortedUser);

        const isCorrect = sortedCorrectStr === sortedUserStr;

        if (isCorrect) {
            score++;
        }
        
        // --- CHUẨN BỊ DỮ LIỆU ĐỂ GỬI LÊN SERVER (LƯU NỘI DUNG ĐÁP ÁN) ---
        const optionsMap = {
            'A': q.Dap_an_A,
            'B': q.Dap_an_B,
            'C': q.Dap_an_C,
            'D': q.Dap_an_D
        };

        const correctContent = correctAnswers.map(key => optionsMap[key] || `[Key ${key} không có nội dung]`);
        const userContent = userSelectedAnswers.map(key => optionsMap[key] || `[Key ${key} không có nội dung]`);

        submissionDetail.push({
            Q_ID: q.ID,
            Q_Content: q.Cau_hoi,
            Your_Keys: sortedUser.join(', '),
            Your_Content: userContent.join(' | '),
            Correct_Keys: sortedCorrect.join(', '),
            Correct_Content: correctContent.join(' | '),
            Result: isCorrect ? 'ĐÚNG' : 'SAI',
            Explanation: q.Giai_thich || '' 
        });

        // Lưu kết quả review chi tiết cho details.html
        quizReview.push({
            index: index + 1,
            question: q.Cau_hoi,
            isCorrect: isCorrect,
            user: userSelectedAnswers,
            correct: sortedCorrect, // Thêm đáp án đúng (Key) 
            options: optionsMap,    // Thêm nội dung đáp án (Value)
            type: String(q.Loai_cau_hoi).toLowerCase()
        });
    });

    // 1. Lưu kết quả vào sessionStorage để chuyển sang trang details.html
    const finalResult = {
        studentInfo: studentInfo,
        score: score,
        total: questions.length,
        timeTaken: timeTaken,
        reviewData: quizReview 
    };
    sessionStorage.setItem('finalQuizResult', JSON.stringify(finalResult));

    // 2. Chuyển sang trang thông báo và xem chi tiết
    renderSubmissionConfirmation(); 

    // 3. Gửi kết quả chi tiết lên server
    fetch('/api/saveResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentInfo,
            score,
            total: questions.length,
            timeTaken,
            answers: submissionDetail // GỬI submissionDetail (Chứa nội dung đáp án)
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log('Kết quả đã được lưu:', data.message);
    })
    .catch(err => {
        console.error('Lỗi khi gửi kết quả:', err);
        alert('LỖI NỘP BÀI. Vui lòng kiểm tra kết nối mạng và thử lại. Chi tiết lỗi đã được ghi vào console log.');
    });

    // Xóa dữ liệu bài làm sau khi nộp bài
    localStorage.removeItem('studentInfo');
    localStorage.removeItem('quizQuestions');
    localStorage.removeItem('userAnswers');
});

// 5. Hiển thị trang xác nhận nộp bài (THAY THẾ renderResults cũ)
function renderSubmissionConfirmation() {
    submitBtn.style.display = 'none';
    quizContainer.innerHTML = '';
    document.getElementById('timer-box').style.display = 'none';

    // Lấy dữ liệu tạm thời để hiển thị link
    const finalResult = JSON.parse(sessionStorage.getItem('finalQuizResult'));

    resultDiv.innerHTML = `
        <div class="result-summary text-center" style="padding: 20px; border: 1px solid #28a745; border-radius: 8px; background-color: #e9f7ef;">
            <h2>✅ HỆ THỐNG ĐÃ GHI NHẬN BÀI LÀM CỦA BẠN ✅</h2>
            <p style="font-size: 1.1em; margin: 15px 0;">Xin chúc mừng, bạn đã hoàn thành bài kiểm tra.</p>
            <p style="font-size: 1em; color: gray;">Thông tin của bạn: <strong>${finalResult.studentInfo.name}</strong> - Lớp: <strong>${finalResult.studentInfo.class}</strong></p>

            <a href="details.html" style="
                display: inline-block;
                margin-top: 25px;
                padding: 12px 25px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
            ">
                Xem Bài Làm Chi Tiết và Điểm Số
            </a>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 6px;">
            <p style="color: #856404; font-weight: bold;">LƯU Ý QUAN TRỌNG:</p>
            <p style="color: #856404;">Thông tin chi tiết và đáp án chỉ có thể được xem trên trang kết quả sau khi giáo viên cho phép.</p>
        </div>

        <button onclick="window.location.reload()" style="
            padding: 10px 15px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            margin-top: 15px;
            cursor: pointer;
        ">
            Quay lại trang làm bài mới
        </button>
    `;
}
