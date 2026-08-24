# Ngân hàng câu hỏi Tin học THCS

Phiên bản 2: ứng dụng web tĩnh chạy bằng HTML, CSS và JavaScript, phù hợp triển khai trên GitHub Pages.

## Chức năng hiện có

- Thêm, sửa, xóa và nhân bản câu hỏi.
- Mỗi câu hỏi có bốn lựa chọn, một đáp án đúng và phần giải thích.
- Phân loại theo khối lớp, bộ sách, chủ đề, bài học, mức độ và trạng thái.
- Tìm kiếm và lọc câu hỏi.
- Thống kê số câu theo mức độ.
- Lưu dữ liệu bằng `localStorage`.
- Nhập và xuất dữ liệu JSON.
- Giao diện tương thích điện thoại.

## Cách chạy trên máy

Do ứng dụng dùng `fetch()` để đọc dữ liệu mẫu, nên chạy qua một máy chủ cục bộ.

### Cách 1: VS Code Live Server

1. Mở thư mục dự án bằng VS Code.
2. Cài tiện ích Live Server.
3. Nhấn chuột phải vào `index.html`.
4. Chọn **Open with Live Server**.

### Cách 2: Python

```bash
python3 -m http.server 8000
```

Mở trình duyệt tại:

```text
http://localhost:8000
```

## Đưa lên GitHub Pages

1. Tạo repository mới trên GitHub.
2. Tải toàn bộ nội dung thư mục này lên repository.
3. Vào **Settings → Pages**.
4. Ở mục **Build and deployment**, chọn:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Nhấn **Save**.
6. Chờ GitHub cung cấp địa chỉ trang web.

## Lưu ý quan trọng

Dữ liệu hiện được lưu trong trình duyệt bằng `localStorage`.

- Mỗi trình duyệt hoặc thiết bị có dữ liệu riêng.
- Xóa dữ liệu trình duyệt sẽ mất ngân hàng đang lưu.
- Hãy thường xuyên dùng nút **Xuất JSON** để sao lưu.
- Giai đoạn tiếp theo sẽ chuyển dữ liệu sang Google Sheets thông qua Google Apps Script.

## Cấu trúc dữ liệu câu hỏi

```json
{
  "id": "T7-CD-A-B01-TH-0001",
  "grade": "7",
  "book": "Cánh Diều",
  "topic": "Chủ đề A",
  "lesson": "Bài 1",
  "lessonName": "Thiết bị vào và thiết bị ra",
  "level": "TH",
  "content": "Nội dung câu hỏi",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 0,
  "explanation": "Giải thích đáp án",
  "tags": ["thiết bị vào"],
  "status": "approved",
  "source": "manual",
  "createdAt": "2026-08-24T00:00:00.000Z",
  "updatedAt": "2026-08-24T00:00:00.000Z"
}
```

## Lộ trình tiếp theo

1. Tách danh mục chủ đề và bài học thành tệp riêng.
2. Thêm nhập dữ liệu từ Excel/CSV.
3. Thêm bộ kiểm định chất lượng câu hỏi.
4. Kết nối Google Sheets bằng Google Apps Script.
5. Tạo ma trận đề.
6. Sinh đề và tổ chức kiểm tra trực tuyến.


## Chức năng mới ở phiên bản 2

- Danh mục chủ đề và bài học được tách riêng trong `data/lesson-catalog.json`.
- Khi thêm/sửa câu hỏi, chủ đề và bài học được chọn từ danh sách liên kết.
- Nhập hàng loạt từ Excel hoặc CSV.
- Xem trước dòng hợp lệ và dòng có lỗi trước khi nhập.
- Xuất toàn bộ ngân hàng ra Excel.
- Tự chuyển dữ liệu localStorage của phiên bản 1 sang phiên bản 2.

## Mẫu cột nhập Excel/CSV

`grade, book, topic, lesson, lessonName, level, content, optionA, optionB, optionC, optionD, correctAnswer, explanation, tags, status`

`correctAnswer` nhận A/B/C/D hoặc 0/1/2/3. `level` nhận NB/TH/VD.

> Chức năng Excel dùng thư viện SheetJS từ CDN nên thiết bị cần kết nối Internet khi mở ứng dụng.


## Cập nhật 2.1 – thống nhất bộ sách Kết nối tri thức

- Bộ sách được cố định mặc định là **Kết nối tri thức**.
- Khi thêm hoặc sửa câu hỏi, giáo viên không cần chọn bộ sách.
- Bộ lọc bộ sách đã được lược bỏ.
- Khi nhập Excel, CSV hoặc JSON, ứng dụng tự gán bộ sách là **Kết nối tri thức**.
- Dữ liệu cũ được tự động chuẩn hóa sang bộ sách Kết nối tri thức.

## Cập nhật phiên bản 3 – hoàn thiện ngân hàng câu hỏi cơ bản

- Kiểm định chất lượng tự động và chấm điểm 0–100.
- Phát hiện câu hỏi trùng hoàn toàn và gần trùng.
- Cảnh báo đáp án đúng dài nổi bật, phương án quá giống nhau, từ phủ định chưa làm nổi bật, giải thích quá ngắn.
- Không cho chuyển câu hỏi sang **Đã duyệt** khi còn lỗi nghiêm trọng.
- Kiểm định toàn bộ ngân hàng và xuất báo cáo CSV.
- Lọc câu hỏi theo kết quả chất lượng.
- Không xóa vật lý câu hỏi; thao tác **Ngừng dùng** giữ lại dữ liệu lịch sử.
- Chủ đề, bài học có thể chọn từ danh mục hoặc nhập thủ công khi danh mục chưa đầy đủ.

### Giới hạn của kiểm định tự động

Kiểm định chỉ hỗ trợ phát hiện dấu hiệu kỹ thuật. Giáo viên vẫn cần kiểm tra tính chính xác kiến thức, sự phù hợp với bài học, mức độ nhận thức và khả năng có nhiều đáp án hợp lý.


## Phiên bản 4 – Google Sheets tập trung

Đã bổ sung:

- Backend Google Apps Script trong thư mục `apps-script/`.
- Lưu toàn bộ ngân hàng trên sheet `Questions`.
- Cài đặt URL Web App và mã truy cập ngay trong giao diện.
- Kiểm tra kết nối.
- Tải dữ liệu từ Google Sheets.
- Ghi dữ liệu lên Google Sheets.
- Tự động đồng bộ sau khi thêm, sửa, nhập hoặc ngừng sử dụng câu hỏi.
- Vẫn giữ bản cục bộ để ứng dụng tải nhanh và hoạt động khi mất mạng tạm thời.

Xem hướng dẫn chi tiết tại `apps-script/HUONG-DAN-TRIEN-KHAI.md`.
