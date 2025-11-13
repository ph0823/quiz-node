const lookupClassInput = document.getElementById('lookup-class');
const lookupSttInput = document.getElementById('lookup-stt');
const lookupNameInput = document.getElementById('lookup-name');
const lookupBtn = document.getElementById('lookup-btn');
const lookupMessage = document.getElementById('lookup-message');
const resultWrapper = document.getElementById('result-wrapper');
const initialMessage = document.getElementById('initial-message');
const detailsContainer = document.getElementById('quiz-details');

let allStudentList = [];

// ====================================================================================================================
// --- KHỞI TẠO VÀ TẢI DỮ LIỆU ---
// ====================================================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tải danh sách lớp trước cho chức năng tra cứu
    await fetchStudentData();
    
    // 2. Gán sự kiện cho form tra cứu
    lookupClassInput.addEventListener('change', handleLookupDataChange);
    lookupSttInput.addEventListener('input', handleLookupDataChange);
    lookupBtn.addEventListener('click', handleLookupClick);

    // 3. Kiểm tra sessionStorage (Chế độ Học sinh vừa nộp bài)
    const savedResult = sessionStorage.getItem('finalQuizResult');
    if (savedResult) {
        const finalResult = JSON.parse(savedResult);
        sessionStorage.removeItem('finalQuizResult'); // Xóa ngay sau khi đọc
        renderResult(finalResult, 'session');
    }
});

// Hàm Chuyển chuỗi đáp án thành mảng các chuỗi chuẩn hóa.
function parseAnswerKeys(answerKeyString) {
    if (!answerKeyString) return [];
    // Tách chuỗi, chuyển thành chữ hoa, loại bỏ khoảng trắng.
    return String(answerKeyString).toUpperCase().split(',').map(s => s.trim()).filter(s => s);
}

// ----------------------------------------------------
// LOGIC: Tải danh sách lớp và Tự động điền Tên (Giống lookup.js)
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
    const className = lookupClassInput.value.trim();
    const stt = lookupSttInput.value.trim();
    const name = lookupNameInput.value.trim();

    if (!className || !stt || !name || name.includes('Không tìm thấy') || name.includes('Lỗi dữ liệu')) {
        lookupMessage.textContent = 'Vui lòng chọn Lớp và nhập STT hợp lệ để tra cứu.';
        return;
    }

    lookupMessage.textContent = 'Đang tra cứu kết quả...';

    try {
        // Gọi API tra cứu kết quả (API này cần được bạn tạo trong Vercel và Google Script)
        const res = await fetch('/api/lookupResultDetail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, stt, name })
        });

        const data = await res.json();
        
        if (data.success && data.result) {
            // ⭐ Chuyển đổi định dạng dữ liệu từ Server để phù hợp với hàm renderResult
            const formattedResult = formatServerDataForRender(data.result);
            renderResult(formattedResult, 'server');
        } else {
            lookupMessage.textContent = `Không tìm thấy bài làm của học sinh ${name}.`;
            resultWrapper.style.display = 'none';
            initialMessage.style.display = 'block';
        }

    } catch (err) {
        console.error('Lỗi khi tra cứu kết quả:', err);
        lookupMessage.textContent = 'Lỗi kết nối hoặc lỗi server khi tra cứu.';
    }
}

// Hàm chuẩn hóa dữ liệu từ Server (Google Sheet) sang định dạng render
// Dữ liệu từ Sheet sẽ cần được xử lý để lấy lại Chi tiết từng câu hỏi
function formatServerDataForRender(serverData) {
    // result là đối tượng {studentInfo, score, total, timeTaken, reviewData: [{}, {}...]}
    // TẠM THỜI: Dữ liệu từ server có thể chỉ là {Score, Total_Questions, Time_Taken, Submission_Details: [{Q_ID, Correct_Keys, Your_Keys, ...}]}
    
    // Logic này chỉ là giả định, bạn cần đảm bảo Serverless Function trả về đầy đủ các trường sau:
    const reviewData = serverData.Submission_Details.map(d => ({
        index: d.Row_Index_in_Sheet, // Index hoặc số thứ tự câu hỏi
        question: d.Q_Content, 
        isCorrect: d.Result === 'ĐÚNG',
        user: parseAnswerKeys(d.Your_Keys),
        correct: parseAnswerKeys(d.Correct_Keys),
        options: d.Options_Map, // Cần được server cung cấp
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

/**
 * Hiển thị chi tiết bài làm
 * @param {object} finalResult - Dữ liệu kết quả bài làm.
 * @param {string} mode - 'session' (Học sinh) hoặc 'server' (Giáo viên tra cứu).
 */
function renderResult(finalResult, mode) {
    const { studentInfo, score, total, timeTaken, reviewData } = finalResult;

    // Hiển thị khung kết quả và ẩn thông báo ban đầu
    resultWrapper.style.display = 'block';
    initialMessage.style.display = 'none';
    lookupMessage.textContent = ''; // Xóa thông báo tra cứu

    // 1. Hiển thị tóm tắt
    document.getElementById('student-info-display').innerHTML = 
        `Họ và tên: <strong>${studentInfo.name}</strong> - Lớp: <strong>${studentInfo.class}</strong> - STT: <strong>${studentInfo.stt}</strong>`;
    document.getElementById('score-display').innerHTML = 
        `Điểm số: <strong style="color: green; font-size: 1.2em;">${score}/${total}</strong> (Đúng: ${score}, Sai: ${total - score})`;
    document.getElementById('time-display').innerHTML = 
        `Thời gian làm bài: ${timeTaken}`;
    
    // Nếu là chế độ học sinh (session), ẩn form tra cứu
    if (mode === 'session') {
        document.getElementById('lookup-area').style.display = 'none';
    }


    // 2. Hiển thị chi tiết từng câu hỏi
    let html = '';
    reviewData.forEach((item, index) => {
        const questionNumber = item.index || (index + 1);
        const resultText = item.isCorrect ? '<span class="correct-answer">ĐÚNG</span>' : '<span class="wrong-answer">SAI</span>';
        const resultClass = item.isCorrect ? 'style="border-color: green;"' : 'style="border-color: red;"';
        
        // Dùng Object.entries để đảm bảo thứ tự A, B, C, D nếu item.options là map
        const allOptions = item.options ? Object.entries(item.options).filter(([key, value]) => value && String(value).trim() !== '') : [];

        // Hàm kiểm tra đáp án và trả về class CSS
        const getOptionClass = (key) => {
            const isUserSelected = item.user.includes(key);
            const isCorrectKey = item.correct.includes(key);

            if (isUserSelected && isCorrectKey) {
                return 'selected-correct'; // Người dùng chọn đúng
            } else if (isUserSelected && !isCorrectKey) {
                return 'selected-wrong'; // Người dùng chọn sai
            } else if (!isUserSelected && isCorrectKey) {
                return 'correct-key'; // Đáp án đúng nhưng người dùng không chọn
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
        
        // Hiển thị giải thích (chỉ khi có)
        if (item.explanation) {
             html += `<div class="explanation"><strong>Giải thích:</strong> ${item.explanation}</div>`;
        }
        
        html += `</div></div>`;
    });

    detailsContainer.innerHTML = html;
}
