const lookupClassInput = document.getElementById('lookup-class');
const lookupSttInput = document.getElementById('lookup-stt');
const lookupNameInput = document.getElementById('lookup-name');
const lookupBtn = document.getElementById('lookup-btn');
const lookupMessage = document.getElementById('lookup-message');
const resultWrapper = document.getElementById('result-wrapper');
const initialMessage = document.getElementById('initial-message');
const detailsContainer = document.getElementById('quiz-details');

const adminCodeInput = document.getElementById('admin-code');
const unlockBtn = document.getElementById('unlock-btn');
const traCuuForm = document.getElementById('tra-cuu-form');
const authMessage = document.getElementById('auth-message');
const scoreDisplay = document.getElementById('score-display');
const modeDisplay = document.getElementById('mode-display');

// MÃ KHÓA BẢO MẬT (Giáo viên cần nhập mã này. Nên được lưu trữ an toàn hơn)
const ADMIN_SECRET_CODE = '123456'; 

let allStudentList = [];
let isTeacherMode = false;

// ====================================================================================================================
// --- KHỞI TẠO VÀ TẢI DỮ LIỆU ---
// ====================================================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải danh sách lớp trước cho chức năng tra cứu
    await fetchStudentData();
    
    // 2. Gán sự kiện cho form tra cứu (Chỉ hoạt động khi Mở khóa)
    lookupClassInput.addEventListener('change', handleLookupDataChange);
    lookupSttInput.addEventListener('input', handleLookupDataChange);
    lookupBtn.addEventListener('click', handleLookupClick);

    // 3. Gán sự kiện Mở khóa Giáo viên
    unlockBtn.addEventListener('click', handleUnlock);

    // 4. Kiểm tra sessionStorage (Chế độ Học sinh vừa nộp bài)
    const savedResult = sessionStorage.getItem('finalQuizResult');
    if (savedResult) {
        const finalResult = JSON.parse(savedResult);
        sessionStorage.removeItem('finalQuizResult'); // Xóa ngay sau khi đọc
        renderResult(finalResult, 'student');
    }
});

// Hàm chuyển chuỗi đáp án thành mảng các chuỗi chuẩn hóa.
function parseAnswerKeys(answerKeyString) {
    if (!answerKeyString) return [];
    return String(answerKeyString).toUpperCase().split(',').map(s => s.trim()).filter(s => s);
}

// ----------------------------------------------------
// LOGIC: MỞ KHÓA GIÁO VIÊN
// ----------------------------------------------------
function handleUnlock() {
    if (adminCodeInput.value === ADMIN_SECRET_CODE) {
        isTeacherMode = true;
        authMessage.textContent = 'Mở khóa thành công! Bạn có thể tra cứu bài làm.';
        authMessage.style.color = 'green';
        document.getElementById('auth-check').style.display = 'none';
        traCuuForm.style.display = 'block'; // Hiển thị form tra cứu
        
        // Sau khi mở khóa, ẩn thông báo ban đầu và hiển thị vùng kết quả (trống)
        resultWrapper.style.display = 'none';
        initialMessage.style.display = 'block';
        initialMessage.innerHTML = '<p>Vui lòng sử dụng chức năng tra cứu để xem chi tiết bài làm.</p>';
        
    } else {
        authMessage.textContent = 'Mã khóa không đúng. Vui lòng thử lại.';
        authMessage.style.color = 'red';
    }
}

// ----------------------------------------------------
// LOGIC: Tải danh sách lớp và Tự động điền Tên
// ----------------------------------------------------

async function fetchStudentData() {
    lookupClassInput.innerHTML = '<option value="">-- Đang tải Lớp... --</option>';
    try {
        const response = await fetch('/api/student'); 
        const json = await response.json();
        
        if (json.data && json.data.length > 0) {
            allStudentList = json.data;
            populateClassDropdown();
        } else {
            lookupClassInput.innerHTML = '<option value="">-- Lỗi tải lớp --</option>';
        }
    } catch (error) {
        lookupClassInput.innerHTML = '<option value="">-- Lỗi kết nối --</option>';
    }
}

function populateClassDropdown() {
    const uniqueClasses = [...new Set(allStudentList.map(s => String(s.Lop || '').trim()))].filter(c => c);

    lookupClassInput.innerHTML = '<option value="">-- Chọn Lớp --</option>';
    uniqueClasses.sort().forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        lookupClassInput.appendChild(option);
    });
}

function handleLookupDataChange() {
    const selectedClass = lookupClassInput.value.trim();
    const stt = lookupSttInput.value.trim();
    lookupNameInput.value = '';

    if (selectedClass && stt) {
        const foundStudent = allStudentList.find(s => 
            String(s.Lop || '').trim() === selectedClass && 
            String(s.STT || '').trim() === stt
        );

        if (foundStudent) {
            const studentName = foundStudent.Ten_hoc_sinh || foundStudent.Ho_ten || foundStudent.Ten; 
            if (studentName) {
                lookupNameInput.value = String(studentName).trim();
            } else {
                lookupNameInput.value = 'Lỗi dữ liệu';
            }
        } else {
            lookupNameInput.value = 'Không tìm thấy học sinh';
        }
    }
}

// ====================================================================================================================
// --- LOGIC TRA CỨU KẾT QUẢ TỪ SERVER (CHẾ ĐỘ GIÁO VIÊN) ---
// ====================================================================================================================

async function handleLookupClick() {
    if (!isTeacherMode) {
        authMessage.textContent = 'Bạn chưa mở khóa chức năng tra cứu.';
        return;
    }
    
    const className = lookupClassInput.value.trim();
    const stt = lookupSttInput.value.trim();
    const name = lookupNameInput.value.trim();

    if (!className || !stt || !name || name.includes('Không tìm thấy') || name.includes('Lỗi dữ liệu')) {
        authMessage.textContent = 'Vui lòng chọn Lớp và nhập STT hợp lệ.';
        authMessage.style.color = 'red';
        return;
    }

    authMessage.textContent = 'Đang tra cứu kết quả...';
    authMessage.style.color = '#007bff';

    try {
        // Gọi API tra cứu kết quả chi tiết
        const res = await fetch('/api/lookupResultDetail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, stt, name })
        });

        const data = await res.json();
        
        if (data.success && data.result) {
            // ⭐ Chuyển đổi định dạng dữ liệu từ Server để phù hợp với hàm renderResult
            const formattedResult = formatServerDataForRender(data.result);
            renderResult(formattedResult, 'teacher'); // Chế độ giáo viên
        } else {
            authMessage.textContent = `Không tìm thấy bài làm của học sinh ${name}.`;
            authMessage.style.color = 'red';
            resultWrapper.style.display = 'none';
            initialMessage.style.display = 'block';
        }

    } catch (err) {
        console.error('Lỗi khi tra cứu kết quả:', err);
        authMessage.textContent = 'Lỗi kết nối hoặc lỗi server khi tra cứu.';
        authMessage.style.color = 'red';
    }
}

// Hàm chuẩn hóa dữ liệu từ Server (Giả định)
function formatServerDataForRender(serverData) {
    
    // Lưu ý: Cần đảm bảo serverData.Submission_Details chứa các trường Q_Content, Correct_Keys, Your_Keys, Options_Map, ...
    
    const reviewData = serverData.Submission_Details.map(d => ({
        index: d.Row_Index_in_Sheet,
        question: d.Q_Content, 
        isCorrect: d.Result === 'ĐÚNG',
        user: parseAnswerKeys(d.Your_Keys),
        correct: parseAnswerKeys(d.Correct_Keys),
        options: d.Options_Map || {}, 
        explanation: d.Explanation || '',
    }));

    return {
        studentInfo: { name: serverData.Ten_hoc_sinh, class: serverData.Lop, stt: serverData.STT },
        score: serverData.Score,
        total: serverData.Total_Questions,
        timeTaken: serverData.Time_Taken,
        reviewData: reviewData 
    };
}


// ====================================================================================================================
// --- LOGIC HIỂN THỊ KẾT QUẢ ---
// ====================================================================================================================

function renderResult(finalResult, mode) {
    const { studentInfo, score, total, timeTaken, reviewData } = finalResult;

    // Hiển thị khung kết quả và ẩn thông báo ban đầu
    resultWrapper.style.display = 'block';
    initialMessage.style.display = 'none';
    
    // 1. Cấu hình chế độ hiển thị
    if (mode === 'student') {
        // Chế độ Học sinh: Ẩn điểm, ẩn chức năng tra cứu
        scoreDisplay.style.display = 'none';
        document.getElementById('lookup-area').style.display = 'none';
        modeDisplay.textContent = '(Chế độ xem chi tiết bài làm đã nộp. Giáo viên sẽ thông báo điểm sau.)';
    } else if (mode === 'teacher') {
        // Chế độ Giáo viên: Hiển thị điểm, ẩn thông báo tra cứu
        scoreDisplay.style.display = 'block';
        modeDisplay.textContent = '(Chế độ Tra cứu Giáo viên)';
        authMessage.textContent = '';
    }

    // 2. Hiển thị tóm tắt
    document.getElementById('student-info-display').innerHTML = 
        `Họ và tên: <strong>${studentInfo.name}</strong> - Lớp: <strong>${studentInfo.class}</strong> - STT: <strong>${studentInfo.stt}</strong>`;
    
    // Chỉ hiển thị điểm nếu là chế độ giáo viên
    scoreDisplay.innerHTML = 
        `ĐIỂM SỐ: <strong style="color: green; font-size: 1.2em;">${score}/${total}</strong>`;
        
    document.getElementById('time-display').innerHTML = 
        `Thời gian làm bài: ${timeTaken}`;
    
    // 3. Hiển thị chi tiết từng câu hỏi
    let html = '';
    reviewData.forEach((item, index) => {
        const questionNumber = item.index || (index + 1);
        const resultText = item.isCorrect ? '<span class="correct-answer">ĐÚNG</span>' : '<span class="wrong-answer">SAI</span>';
        const resultClass = item.isCorrect ? 'style="border-color: green;"' : 'style="border-color: red;"';
        
        // Hàm kiểm tra đáp án và trả về class CSS
        const getOptionClass = (key) => {
            const isUserSelected = item.user.includes(key);
            const isCorrectKey = item.correct.includes(key);

            if (isUserSelected && isCorrectKey) {
                return 'selected-correct'; 
            } else if (isUserSelected && !isCorrectKey) {
                return 'selected-wrong'; 
            } else if (!isUserSelected && isCorrectKey) {
                return 'correct-key'; 
            }
            return '';
        };

        html += `
            <div class="question-detail" ${resultClass}>
                <h4>Câu ${questionNumber}: ${item.question} - ${resultText}</h4>
                <div class="options-detail">
        `;
        
        // Hiển thị nội dung đáp án A, B, C, D
        ['A', 'B', 'C', 'D'].forEach(key => {
            const content = item.options ? item.options[key] : '';
            if (content && content.trim() !== '') {
                const optionClass = getOptionClass(key);
                html += `
                    <div class="option-detail ${optionClass}">
                        <strong>${key}:</strong> ${content}
                    </div>
                `;
            }
        });

        // Hiển thị chi tiết đáp án
        html += `<p style="margin-top: 10px;">
                    Đáp án bạn chọn: <strong>${item.user.length > 0 ? item.user.join(', ') : '(Chưa chọn)'}</strong>. 
                    Đáp án đúng (Key): <strong>${item.correct.join(', ')}</strong>
                </p>`;
        
        // Hiển thị giải thích
        if (item.explanation) {
             html += `<div class="explanation"><strong>Giải thích:</strong> ${item.explanation}</div>`;
        }
        
        html += `</div></div>`;
    });

    detailsContainer.innerHTML = html;
}
