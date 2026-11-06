# Mukbang Wardrobe — bàn giao78 file

Đã hoàn tất CHECKLIST-WARDROBE.csv theo ART-REQUEST-WARDROBE ngày05/11/2026. Chỉ bàn giao art; dev tích hợp vào game.

## Runtime

-54 lớp phủ trong art5/wardrobe. Outfit512×420: đặt cùng gốc body V3. Đây là patch body hoàn chỉnh có áo và tay/cổ giữ tư thế gốc để che kín áo cũ. Head được vẽ sau body như game hiện tại.
-Hair/extras512×512: đặt cùng gốc head V3, vẽ sau head và biểu cảm. Mỗi streamer có vị trí/kích thước riêng; không dùng neo V4 cũ. Neo được chép nguyên từ refs/streamer-v3-anchors.json trong manifest.
-19 icon128×128 và5 UI trong assets/wardrobe. Icon neo[64,64]; tab96×96 neo[48,48]; badge120×40 neo[60,20]. badge_ad có chữ ▶ UNLOCK; badge_gift là hộp quà kèm khoá, text level do game đặt.
-Kính không có mắt vẽ sẵn. Tròng tròn để trong; pigment sáng của tròng kính được xuất alpha tối đa khoảng25%, giữ gọng màu. Giữ thứ tự lớp để biểu cảm động còn đọc rõ.

## Kỹ thuật và kiểm tra

PNG indexed palette alpha, không dither, có padding. Main84883byte; art5 1041794byte. Mọi overlay dưới45000byte, main dưới150000byte và art5 dưới4MB. qa.json ghi số đo từng file, SHA256, kiểm kích thước/palette/padding và vùng mắt/miệng.

manifest.wardrobe.fragment.json ghi đường dẫn/package/neo/kích thước; registration.json ghi phép căn của54 overlay; main-registration.json ghi icon và badge. Các tab là bản resample của icon đã chọn: outfit_default, hair_bow, acc_glasses_round.

Art sinh bằng built-in ImageGen dựa trên PNG V3 đã bàn giao. generation-log.json giữ prompt thực tế và lịch sử chỉnh; selection.json nối nguồn đang chọn với PNG cuối. Ảnh nguồn ở production-wardrobe/sources trong workspace, không gộp vào ZIP runtime. Phụ kiện dùng nguồn art chung nhưng căn riêng theo từng đầu; bảng kiểm hình ảnh xác nhận độ khớp cho cả3 streamer.

preview-looks.png là bảng3×3 đúng CHEF/KITTY/SUPERSTAR với body+outfit+head+idle eyes/mouth+hair+extras. previews/ có bảng kiểm từng outfit, hair, extras và main UI.

Những chỉnh đã xử lý: bỏ chữ ngoài spec khỏi chef/sakura, yếm giữ một YUM nhỏ; icon yếm tách áo bên dưới; chụp tai thu nhỏ để không che mắt. Bộ polish61 file đã bàn giao riêng, không lặp vào ZIP này.
