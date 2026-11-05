# Handoff art V4 — ba nhóm ưu tiên

Đã xuất 114/114 đường dẫn yêu cầu; còn 0. Tổng dung lượng asset hiện có: 786740 byte. Trạng thái này không đồng nghĩa đã hoàn tất toàn bộ art của tám recipe.

Phạm vi: chai vị và broth; topping và deco; bảy dụng cụ hai trạng thái cùng fill bình rót; sáu cặp thạch trong/ngoài khuôn, các lớp chi tiết riêng; nền bếp. Hoãn concept và character theo yêu cầu chủ dự án.

PNG dùng chính art bàn giao làm reference. Giữ nguồn và prompt trong generation-log.json. Icon hành và sprite lát hành là hai ảnh riêng vì khác hình; các topping còn lại dùng cùng nguồn cho 160 và 96 px. Fill thạch phải xám trung tính; detail là lớp không tint, theo ART-REQUEST-V4 §2.2. Tên *_detail là phần mở rộng manifest được ghi rõ, dev cần ghép cùng fill. Khuôn cũ vẫn nằm ở production/assets/cook và không tính vào số đường dẫn mới ở trên.

manifest.core.fragment.json liệt kê asset thực có, kích thước, neo giữa và SHA256. Tất cả tạm map vào subpackage art4 để dev chọn phần đưa vào gói chính trong ngân sách còn lại; không sửa loader hoặc gameplay. core-tech-qa.json chứa kiểm kỹ thuật; CORE-PENDING.txt là danh sách chưa có. Chưa bàn giao đủ container, UI, đĩa phục vụ hoặc art ngoài ba nhóm ưu tiên.

ZIP kèm 12 dependency đã bàn giao trước: 6 khuôn và 6 icon khuôn. Chúng không cộng vào số 114 file mới. PNG được xuất palette có alpha, không dithering; bộ nén palette nội bộ thay cho pngquant CLI không có trong môi trường. Các phép căn lớp chỉ resample/căn vị trí art đã gen, không vẽ lại bằng code; số đo trong các JSON registration.

Nền bếp: 1080x2340 JPEG q80, mặt bàn bắt đầu tại y1404 (40% dưới). Chi tiết căn ảnh trong kitchen-framing.json.
