# Mukbang Bang — Non-character Art V4 (đợt tạm 04/11/2026)

**Chưa phải bộ V4 hoàn chỉnh.** Phong cách đã được chủ dự án duyệt. Phạm vi: mọi art V4 và 6 concept, loại nhân vật và overlay gắn lên người; giữ icon/tab/badge Wardrobe và fauna/FX bối cảnh theo concept dev.

## Đã xuất: 31 file
- 6 foreground phòng PNG 1080x2400, alpha cửa sổ thật, 48% dưới không có lỗ alpha. Space Diner đã sửa lỗi sàn trong suốt.
- 5 feature icon: market/delivery/buffet/wardrobe 256x256; lock 96x96. Buffet đã sửa nền mờ.
- 6 khuôn 600x600 + 6 icon khuôn 160x160, mỗi cặp cùng một ảnh nguồn.
- 6 icon món concept 256x256: đủ 4 món Night Market, Dango và Matcha Latte. Matcha Latte dùng lại PNG bàn giao gốc; bản sinh mới có haze được giữ trong sources để truy vết, không nằm trong assets.
- 1 view Sakura 1080x800: tái dùng/crop cảnh vườn V1, JPEG q80. Kích thước view là quy ước bổ sung vì brief concept không chốt kích thước view.
- 1 pip_off 40x40: tái dùng UI Stage1, có 2px padding.

## QA và spec
- 31/31 đúng kích thước đã quy định trong job/spec; toàn bộ sprite có padding, không có character.
- Đã xem trực quan feature icons, khuôn, món đã có và composite Sakura. Chưa playtest tích hợp.
- windowAlphaBounds đo từ PNG xuất cuối, gồm biên alpha <240; có trong manifest.fragment.json. Các vùng tường/sàn gần opaque của ImageGen được chuẩn hóa lúc xuất (alpha >=240 thành255, <=16 thành0; giữ biên trung gian).
- PNG palette không dither; sai lệch RGB trung bình sau nén dưới 3/255 so với PNG nguồn đã chuẩn kích thước. Đợt này dùng encoder palette trong project, **chưa chạy pngquant** như công cụ nén nêu trong brief.
- Đề xuất main thêm khoảng 84KB, tổng main khoảng 3.27MB với baseline V4. Các file lớn/room/concept được gán art4; riêng phần hiện có của art4 khoảng 2.66MB. Đây là mapping đề xuất cho dev, chưa khai báo subpackage hoặc sửa loader.
- Hai foreground còn phải bổ sung chi tiết: Night Market (dây đèn, bảng YUMYUM STALL) và Fire Challenge (SPICE LEVEL/display). Xem revisions.json.

## Còn lại
253 đường dẫn trong pending-assets.csv. Bao gồm 18 món concept còn lại, 5 view mới, lớp fill grayscale, recipe plates đủ 3 trạng thái, topping/deco, dụng cụ, FX, nền bếp, UI cooking và Wardrobe UI. Ngoài các đường dẫn thiếu, còn 2 lần sửa chi tiết phòng đã ghi riêng.

Mục tiêu sản xuất đã được triển khai thành generation-jobs.json: 241 job nguồn + các bản xuất lại cùng hình ở kích thước khác; 6 room được quản lý riêng. Các kích thước mới không được brief concept quy định có ghi specExtension. Không tính bảng concept là sprite game. Không thay ảnh còn thiếu bằng placeholder.

## Tệp bàn giao
- assets/: PNG/JPG đã xuất; chưa chép vào game đang chạy.
- manifest.fragment.json: registry phần đã có, kích thước, neo, window bounds, hash và package mapping; pending tách rõ. KHÔNG ghi đè manifest V1 hiện tại.
- validation.json: kết quả kiểm kỹ thuật và trạng thái chưa hoàn chỉnh.
- previews/: bảng xem trước; chữ PENDING thể hiện các ô chưa tạo.
- generation-log.json: prompt thực tế, reference PNG và hash.
- reuse-log.json: nguồn các ảnh tái sử dụng.
- inventory.json / generation-jobs.json / pending-assets.csv / revisions.json: điểm tiếp tục.
- sources/: giữ ảnh gốc, bản chuẩn kích thước và các bản nháp bị thay thế; không đưa vào ZIP nhẹ.

## Công cụ bị giới hạn
Built-in ImageGen báo usage_limit_reached khi tạo food_taiyaki.png. Công cụ trả thời điểm khôi phục dự kiến **16:44:27 ngày 04/11/2026, giờ Việt Nam**. Chưa dùng CLI/API thay thế.

Tiếp tục từ food_taiyaki.png, rồi hoàn thiện món concept/view và cooking theo checklist. Mỗi món phải đưa PNG bàn giao gốc phù hợp trực tiếp vào ImageGen; các trạng thái ăn dở dùng ảnh full-serving đã chọn làm edit target để giữ hình và camera. Không tạo lại file đã đạt; chỉ sửa những mục được QA ghi needs-fix/needs-concept-details.
