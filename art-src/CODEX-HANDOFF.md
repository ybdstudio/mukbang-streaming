# Mukbang Bang — bàn giao art 03/11/2026

Bộ art theo ART-REQUEST.md đã hoàn thiện sau khi duyệt mẫu Luna revision 4: mặt trẻ, tóc búi mềm, cổ ngắn và sweater mint cổ tròn. Chew và sour dùng bản biểu cảm đã sửa ở revision 3. Kiko mặc sweater vàng; Momo mặc sweater hồng, tóc dài thẳng và beret tím.

## File bàn giao

- `mukbang-bang/assets/food/`: 36 món, 120 PNG 256×256; id và số miếng giữ theo `src/data.js`.
- `assets/streamer/`: 6 lớp đầu/thân của 3 nhân vật, cùng `face_parts.png` gồm 8 cặp mắt, 10 miệng và 2 hiệu ứng.
- `assets/bg/`: 5 nền JPG 1080×2400.
- `assets/store/`: 6 file đúng danh sách chi tiết: nền cửa hàng, thanh kệ, giỏ, máy quét, băng chuyền và gấu thu ngân. Bảng tổng của brief ghi 7 nhưng bảng chi tiết chỉ có 6 file.
- `assets/ui/`: 3 atlas icons/reactions/avatars, điện thoại gậy selfie và logo MUKBANG BANG.
- `icon-512.png`: icon app ở gốc repo, bên ngoài gói TikTok.
- `assets/manifest.json`: registry 143 ảnh trong gói, kích thước, dung lượng và điểm neo.
- `art-src/full/previews/`: bảng 36 món, 6 bảng frame ăn dở, 3 nhân vật, biểu cảm, nền, cửa hàng và UI.
- `art-src/full/validation.json`: kết quả kiểm tra và ngân sách thực tế.

## Điểm cần dùng khi tích hợp

Toạ độ manifest đều tính ở ảnh 2×. Món ăn dùng canvas 256×256 và neo [128,128]. Mỗi nhân vật có `headAnchor`, `neckOnHead`, `bodyAnchor`, `mouth` và có thể có `eyes` riêng. Momo có tóc dài nên vị trí mặt trên canvas đầu khác Luna/Kiko: phải dùng `streamer[id].eyes` và `.mouth` khi có; nếu thiếu `eyes`, dùng `faceParts.frames[...].at`. Không hard-code cùng vị trí mặt cho cả ba.

Để ghép đầu vào thân: đặt pixel `bodyAnchor` của thân trùng pixel `neckOnHead` của đầu. Để đặt nhân vật lên sân khấu: đặt `headAnchor` vào tâm mặt mong muốn. Bảng xem trước đã ghép từ đúng ảnh và điểm neo này.

`store.checkout_machine.screen` là vùng an toàn để vẽ hoá đơn; `slot` là vùng quét. Màn hình đã làm kín, sáng và để trống. `store.conveyor.slice` là vùng giữa có thể kéo dãn. Giỏ và điện thoại có neo riêng trong manifest.

## Tạo ảnh, nén và kiểm tra

Tất cả ảnh raster được tạo/chỉnh bằng built-in ImageGen; crop ô, resize, ghép lớp theo neo và nén bằng Sharp/libimagequant. PNG indexed với lượng màu thích ứng và không dither; JPG nền q80. Bản gốc PNG và prompt được giữ trong `art-src/`, ngoài gói game. Nguồn đã chọn lưu trong `art-src/style-sample/sources-v4.json` và `art-src/full/generated-sources.json`.

Kiểm tra bằng `node art-src/full/check.cjs`: đủ 36 id / 120 frame; kích thước và alpha; atlas bounds; vị trí neo; nền không vượt 180 KB; icon nằm ngoài gói TikTok; art gồm manifest không vượt 3,2 MB; gói game không vượt 4 MB. Xem số byte thực ở validation.json.

Đã xem trực quan các nhóm món và frame, nhân vật ghép biểu cảm, nền, cửa hàng, atlas, logo và app icon. Các lớp FX trôi là tuỳ chọn và không nằm trong đợt này.

## Phạm vi

Chỉ thêm art và tài liệu. Chưa sửa loader, `art.js`, `build-web.mjs` hay gameplay; game hiện vẫn dùng renderer canvas cũ. Vì không thay mã nguồn game, không chạy lại sim-test hoặc HS kit check. Khi được giao tích hợp, làm theo mục 6 của ART-REQUEST.md và chạy các kiểm tra đó sau khi sửa.
