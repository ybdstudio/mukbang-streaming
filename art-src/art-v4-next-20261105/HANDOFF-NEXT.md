# Mukbang art V4 — đợt tiếp theo

Trạng thái: 67/67 file đã xuất. Main: 164299 byte. Art4: 496220 byte. Đây là phần bếp theo ART-REQUEST-V4-NEXT ngày05/11/2026.

Đường dẫn trong ZIP khớp CHECKLIST-V4-NEXT.csv: assets/cook, assets/stream và art4/cook. Mọi lớp món dùng canvas600x600, anchor[300,300]; điểm chạm bàn gần y470. Icon160x160 anchor[80,80]. Manifest ghi package, kích thước, anchor, slices, SHA256. Registration ghi vùng nguồn/vùng xuất; các phép căn chỉ resample pixel art đã sinh.

PNG palette alpha, không dithering, tạo bằng built-in ImageGen với PNG gốc và art core đã duyệt làm reference. Nguồn, prompt và hash reference trong generation-log.json. PNG nguồn đầy đủ lưu trong thư mục production-next/sources ở workspace, không nhét vào ZIP runtime.

Các lớp fill xám trung tính, khoảng120–235/255. Dev multiply theo vị/nước dùng/màu ly, giữ nguyên alpha. Detail đặt trên fill và không tint. Trà và thành sau ly được xuất alpha bán trong để topping đáy nằm giữa back và tea vẫn nhìn thấy; số đo alpha export được ghi riêng.

Preview mỗi recipe có các bước nấu và hai màu thử: đậm/nhạt; topping, deco dùng lại bộ core. Các preview là kiểm ghép lớp, không sửa gameplay. Bộ core cũ giữ nguyên. Nhân vật, Wardrobe và concept phòng tiếp tục hoãn.

qa.json ghi kiểm đường dẫn, kích thước, alpha, grayscale, khung món và dung lượng. PENDING.txt ghi file chưa xuất; complete trong manifest chỉ đúng khi đủ file và không còn lỗi kỹ thuật. Kiểm hình ảnh/typography ghi trong visual-review.json khi hoàn tất. Lớp600px mục tiêu<=25KB; main mục tiêu<=0,25MB, ngân sách còn khoảng0,45MB; phần món nằm ở subpackage art4.
